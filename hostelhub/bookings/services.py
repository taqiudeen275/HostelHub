"""
Booking domain services.

The heart of shared-occupancy pricing (PRD §9). Every mutation of a Room's
`locked_k` or a Booking's status goes through these functions so the invariants
stay consistent under concurrency.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from hostels.models import HostelStatus, Room, RoomStatus
from .exceptions import (
    BookingError,
    BookingNotCancellableError,
    HostelNotApprovedError,
    InvalidOccupancyError,
    RoomFullError,
    RoomUnavailableError,
)
from .models import (
    ACTIVE_BOOKING_STATUSES,
    Booking,
    BookingStatus,
)


PENDING_WINDOW_MINUTES = getattr(settings, "BOOKING_PENDING_WINDOW_MINUTES", 15)


def _price_per_slot(total_price: Decimal, k: int) -> Decimal:
    """Round to 2dp, half-up, so the sum of slot prices matches the total closely."""
    if k <= 0:
        raise ValueError("k must be positive")
    return (total_price / Decimal(k)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _active_booking_count(room: Room) -> int:
    return Booking.objects.filter(room=room, status__in=ACTIVE_BOOKING_STATUSES).count()


def _recompute_room_state(room: Room) -> None:
    """Recompute locked_k + status based on currently active bookings. Caller holds the lock."""
    active = _active_booking_count(room)
    if active == 0:
        room.locked_k = None
        if room.status != RoomStatus.UNAVAILABLE:
            room.status = RoomStatus.AVAILABLE
    else:
        k = room.locked_k or 0
        if room.status == RoomStatus.UNAVAILABLE:
            # Admin took it off-market; leave alone.
            pass
        elif active >= k:
            room.status = RoomStatus.FULL
        else:
            room.status = RoomStatus.PARTIALLY_BOOKED
    room.save(update_fields=["locked_k", "status"])


# ─── Public API ───────────────────────────────────────────────────────────────


@transaction.atomic
def create_booking(*, student, room: Room, chosen_occupancy: int) -> Booking:
    """
    Atomically create a PENDING_PAYMENT booking, locking the Room row while we do it.

    If the Room has no active bookings, the caller's `chosen_occupancy` becomes
    `locked_k` (within [variant.min_occupancy, variant.max_occupancy]).
    If it does, the caller's chosen occupancy is overridden by the existing lock.
    """
    # Re-fetch under SELECT FOR UPDATE so a concurrent booker can't race us.
    # On SQLite this is a no-op but the write serialization still gives us safety.
    locked_room = (
        Room.objects.select_for_update()
        .select_related("variant__hostel")
        .get(pk=room.pk)
    )
    variant = locked_room.variant
    hostel = variant.hostel

    if hostel.status != HostelStatus.APPROVED:
        raise HostelNotApprovedError(
            f"Hostel '{hostel.name}' is not approved for bookings."
        )
    if locked_room.status == RoomStatus.UNAVAILABLE:
        raise RoomUnavailableError("This room is not accepting bookings right now.")

    if locked_room.locked_k is None:
        if not (variant.min_occupancy <= chosen_occupancy <= variant.max_occupancy):
            raise InvalidOccupancyError(
                f"Chosen occupancy must be between "
                f"{variant.min_occupancy} and {variant.max_occupancy}."
            )
        k = chosen_occupancy
    else:
        # Subsequent booker inherits k; we ignore whatever they sent.
        k = locked_room.locked_k

    active = Booking.objects.filter(
        room=locked_room, status__in=ACTIVE_BOOKING_STATUSES
    ).count()
    if active >= k:
        raise RoomFullError("This room has no remaining slots.")

    price = _price_per_slot(variant.total_price, k)

    booking = Booking.objects.create(
        student=student,
        room=locked_room,
        chosen_occupancy_at_booking=k,
        price_paid=price,
        status=BookingStatus.PENDING_PAYMENT,
        reservation_expires_at=timezone.now() + timedelta(minutes=PENDING_WINDOW_MINUTES),
    )

    locked_room.locked_k = k
    # Recompute status based on new active count (= active + 1 post-create)
    new_active = active + 1
    if new_active >= k:
        locked_room.status = RoomStatus.FULL
    else:
        locked_room.status = RoomStatus.PARTIALLY_BOOKED
    locked_room.save(update_fields=["locked_k", "status"])

    return booking


@transaction.atomic
def confirm_booking(booking: Booking) -> Booking:
    """
    Transition a PENDING_PAYMENT booking → CONFIRMED. Called by the payment webhook.
    Idempotent: if already CONFIRMED (or past), no-op.
    """
    locked = Booking.objects.select_for_update().select_related("room").get(pk=booking.pk)
    if locked.status == BookingStatus.CONFIRMED:
        return locked
    if locked.status != BookingStatus.PENDING_PAYMENT:
        raise BookingError(
            f"Cannot confirm booking in status {locked.status}."
        )
    locked.status = BookingStatus.CONFIRMED
    locked.reservation_expires_at = None
    locked.save(update_fields=["status", "reservation_expires_at", "updated_at"])

    # Also re-lock the room to update its state (in case it was pending-only).
    room = Room.objects.select_for_update().get(pk=locked.room_id)
    _recompute_room_state(room)
    return locked


@transaction.atomic
def cancel_booking(booking: Booking, *, by_user=None) -> Booking:
    """Cancel a booking (student-initiated or system-initiated). Releases the slot."""
    locked = Booking.objects.select_for_update().select_related("room").get(pk=booking.pk)

    cancellable = (
        BookingStatus.PENDING_PAYMENT,
        BookingStatus.CONFIRMED,
    )
    if locked.status not in cancellable:
        raise BookingNotCancellableError(
            f"Booking in status {locked.status} cannot be cancelled."
        )

    locked.status = BookingStatus.CANCELLED
    locked.reservation_expires_at = None
    locked.save(update_fields=["status", "reservation_expires_at", "updated_at"])

    room = Room.objects.select_for_update().get(pk=locked.room_id)
    _recompute_room_state(room)
    return locked


@transaction.atomic
def check_in(booking: Booking) -> Booking:
    locked = Booking.objects.select_for_update().get(pk=booking.pk)
    if locked.status != BookingStatus.CONFIRMED:
        raise BookingError(f"Cannot check in booking in status {locked.status}.")
    locked.status = BookingStatus.CHECKED_IN
    locked.save(update_fields=["status", "updated_at"])
    return locked


@transaction.atomic
def check_out(booking: Booking) -> Booking:
    locked = Booking.objects.select_for_update().select_related("room").get(pk=booking.pk)
    if locked.status != BookingStatus.CHECKED_IN:
        raise BookingError(f"Cannot check out booking in status {locked.status}.")
    locked.status = BookingStatus.CHECKED_OUT
    locked.save(update_fields=["status", "updated_at"])
    # CHECKED_OUT still counts as active (they paid, they occupy the slot for the year).
    # No room-state change needed.
    return locked


def expire_stale_bookings() -> int:
    """
    Sweep PENDING_PAYMENT bookings past their reservation_expires_at.
    Each one is expired in its own atomic block so a single bad row doesn't
    stop the sweep.
    """
    now = timezone.now()
    stale_ids = list(
        Booking.objects.filter(
            status=BookingStatus.PENDING_PAYMENT,
            reservation_expires_at__lt=now,
        ).values_list("id", flat=True)
    )
    count = 0
    for bid in stale_ids:
        try:
            with transaction.atomic():
                booking = (
                    Booking.objects.select_for_update()
                    .select_related("room")
                    .get(pk=bid)
                )
                if booking.status != BookingStatus.PENDING_PAYMENT:
                    continue
                booking.status = BookingStatus.EXPIRED
                booking.reservation_expires_at = None
                booking.save(
                    update_fields=["status", "reservation_expires_at", "updated_at"]
                )
                room = Room.objects.select_for_update().get(pk=booking.room_id)
                _recompute_room_state(room)
                count += 1
        except Exception:  # pragma: no cover - belt-and-braces
            continue
    return count
