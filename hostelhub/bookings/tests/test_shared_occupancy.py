"""Shared-occupancy locking tests. PRD §9.5 — write these red, then implement."""
from decimal import Decimal

import pytest
from django.db import connection
from django.utils import timezone

from bookings.exceptions import (
    InvalidOccupancyError,
    OccupancyLockedError,
    RoomFullError,
)
from bookings.models import Booking, BookingStatus
from bookings.services import (
    cancel_booking,
    create_booking,
    expire_stale_bookings,
)
from hostels.models import Room, RoomStatus


pytestmark = pytest.mark.django_db


# ─── PRD §9.5 canonical tests ─────────────────────────────────────────────────


def test_solo_booking_locks_room_full(student_factory, variant_factory, room_factory):
    variant = variant_factory(total_price=Decimal("3000"), min_occupancy=1, max_occupancy=2)
    room = room_factory(variant=variant)
    ama = student_factory()

    booking = create_booking(student=ama, room=room, chosen_occupancy=1)

    assert booking.status == BookingStatus.PENDING_PAYMENT
    assert booking.chosen_occupancy_at_booking == 1
    assert booking.price_paid == Decimal("3000.00")

    room.refresh_from_db()
    assert room.locked_k == 1
    assert room.status == RoomStatus.FULL


def test_shared_booking_locks_k_for_subsequent_bookers(
    student_factory, variant_factory, room_factory
):
    variant = variant_factory(total_price=Decimal("3000"), min_occupancy=1, max_occupancy=2)
    room = room_factory(variant=variant)

    ama = student_factory()
    kwame = student_factory()

    create_booking(student=ama, room=room, chosen_occupancy=2)
    room.refresh_from_db()
    assert room.locked_k == 2
    assert room.status == RoomStatus.PARTIALLY_BOOKED

    kwame_booking = create_booking(student=kwame, room=room, chosen_occupancy=2)
    room.refresh_from_db()
    assert room.locked_k == 2
    assert room.status == RoomStatus.FULL
    assert kwame_booking.price_paid == Decimal("1500.00")


def test_subsequent_booker_cannot_change_k(student_factory, variant_factory, room_factory):
    """Once k is locked at 2, a second booker passing occupancy=1 still gets k=2."""
    variant = variant_factory(total_price=Decimal("3000"), min_occupancy=1, max_occupancy=2)
    room = room_factory(variant=variant)

    ama = student_factory()
    kwame = student_factory()

    create_booking(student=ama, room=room, chosen_occupancy=2)
    kwame_booking = create_booking(student=kwame, room=room, chosen_occupancy=1)

    assert kwame_booking.chosen_occupancy_at_booking == 2
    assert kwame_booking.price_paid == Decimal("1500.00")


def test_cancellation_before_k_locked_resets_room(
    student_factory, variant_factory, room_factory
):
    """When the sole PENDING booking is cancelled, the room's lock resets."""
    variant = variant_factory(total_price=Decimal("3000"), min_occupancy=1, max_occupancy=2)
    room = room_factory(variant=variant)
    ama = student_factory()

    booking = create_booking(student=ama, room=room, chosen_occupancy=2)
    room.refresh_from_db()
    assert room.locked_k == 2

    cancel_booking(booking)

    room.refresh_from_db()
    assert room.locked_k is None
    assert room.status == RoomStatus.AVAILABLE


def test_cancellation_after_k_locked_keeps_k(
    student_factory, variant_factory, room_factory
):
    """
    Ama books k=2 and her payment confirms, then Kwame books the second slot
    and confirms, then Ama cancels. Kwame's booking stays, k stays at 2, and
    the room becomes partially booked again so a third student can claim the slot.
    """
    variant = variant_factory(total_price=Decimal("3000"), min_occupancy=1, max_occupancy=2)
    room = room_factory(variant=variant)

    ama = student_factory()
    kwame = student_factory()

    ama_booking = create_booking(student=ama, room=room, chosen_occupancy=2)
    kwame_booking = create_booking(student=kwame, room=room, chosen_occupancy=2)

    # Simulate both payments confirming
    for b in (ama_booking, kwame_booking):
        b.status = BookingStatus.CONFIRMED
        b.reservation_expires_at = None
        b.save()

    cancel_booking(ama_booking)

    room.refresh_from_db()
    assert room.locked_k == 2
    assert room.status == RoomStatus.PARTIALLY_BOOKED

    kwame_booking.refresh_from_db()
    assert kwame_booking.status == BookingStatus.CONFIRMED
    assert kwame_booking.price_paid == Decimal("1500.00")


def test_admin_cannot_reduce_max_below_active_k(
    student_factory, variant_factory, room_factory
):
    """max_occupancy can only drop if no room in the variant has k > new max."""
    variant = variant_factory(total_price=Decimal("3000"), min_occupancy=1, max_occupancy=4)
    room = room_factory(variant=variant)
    ama = student_factory()
    create_booking(student=ama, room=room, chosen_occupancy=3)

    from hostels.services import update_variant_max_occupancy

    with pytest.raises(ValueError):
        update_variant_max_occupancy(variant, new_max=2)

    # Dropping to 3 is still fine (equal to locked k)
    update_variant_max_occupancy(variant, new_max=3)
    variant.refresh_from_db()
    assert variant.max_occupancy == 3


@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="SELECT ... FOR UPDATE is a no-op on SQLite; concurrency can't be properly tested",
)
@pytest.mark.django_db(transaction=True)
def test_concurrent_last_slot_only_one_wins(
    student_factory, variant_factory, room_factory
):
    """Two students hit the last slot of a solo room at the same instant; exactly one wins."""
    import threading

    variant = variant_factory(total_price=Decimal("3000"), min_occupancy=1, max_occupancy=1)
    room = room_factory(variant=variant)

    s1 = student_factory()
    s2 = student_factory()

    successes = []
    failures = []
    barrier = threading.Barrier(2)

    def attempt(student):
        try:
            barrier.wait(timeout=5)
            b = create_booking(student=student, room=room, chosen_occupancy=1)
            successes.append(b)
        except RoomFullError:
            failures.append(student)

    t1 = threading.Thread(target=attempt, args=(s1,))
    t2 = threading.Thread(target=attempt, args=(s2,))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    assert len(successes) == 1
    assert len(failures) == 1


# ─── Expiry tests ─────────────────────────────────────────────────────────────


def test_expiry_releases_slot_and_unlocks_k_when_last_holder(
    student_factory, variant_factory, room_factory
):
    variant = variant_factory(total_price=Decimal("3000"), min_occupancy=1, max_occupancy=2)
    room = room_factory(variant=variant)
    ama = student_factory()

    booking = create_booking(student=ama, room=room, chosen_occupancy=2)
    # Fast-forward expiry into the past
    Booking.objects.filter(id=booking.id).update(
        reservation_expires_at=timezone.now() - timezone.timedelta(minutes=1)
    )

    expire_stale_bookings()

    booking.refresh_from_db()
    room.refresh_from_db()

    assert booking.status == BookingStatus.EXPIRED
    assert room.locked_k is None
    assert room.status == RoomStatus.AVAILABLE


def test_expiry_keeps_k_when_other_confirmed_bookings_exist(
    student_factory, variant_factory, room_factory
):
    variant = variant_factory(total_price=Decimal("3000"), min_occupancy=1, max_occupancy=2)
    room = room_factory(variant=variant)
    ama = student_factory()
    kwame = student_factory()

    ama_booking = create_booking(student=ama, room=room, chosen_occupancy=2)
    ama_booking.status = BookingStatus.CONFIRMED
    ama_booking.reservation_expires_at = None
    ama_booking.save()

    kwame_booking = create_booking(student=kwame, room=room, chosen_occupancy=2)
    # Kwame's payment is stale
    Booking.objects.filter(id=kwame_booking.id).update(
        reservation_expires_at=timezone.now() - timezone.timedelta(minutes=1)
    )

    expire_stale_bookings()

    kwame_booking.refresh_from_db()
    room.refresh_from_db()

    assert kwame_booking.status == BookingStatus.EXPIRED
    assert room.locked_k == 2  # Ama still holds the slot
    assert room.status == RoomStatus.PARTIALLY_BOOKED


# ─── Validation tests ─────────────────────────────────────────────────────────


def test_invalid_occupancy_below_min(student_factory, variant_factory, room_factory):
    variant = variant_factory(min_occupancy=2, max_occupancy=4)
    room = room_factory(variant=variant)
    ama = student_factory()

    with pytest.raises(InvalidOccupancyError):
        create_booking(student=ama, room=room, chosen_occupancy=1)


def test_invalid_occupancy_above_max(student_factory, variant_factory, room_factory):
    variant = variant_factory(min_occupancy=1, max_occupancy=2)
    room = room_factory(variant=variant)
    ama = student_factory()

    with pytest.raises(InvalidOccupancyError):
        create_booking(student=ama, room=room, chosen_occupancy=5)


def test_booking_on_full_room_raises(student_factory, variant_factory, room_factory):
    variant = variant_factory(min_occupancy=1, max_occupancy=1)
    room = room_factory(variant=variant)
    ama = student_factory()
    kwame = student_factory()

    create_booking(student=ama, room=room, chosen_occupancy=1)
    with pytest.raises(RoomFullError):
        create_booking(student=kwame, room=room, chosen_occupancy=1)


def test_price_per_slot_rounds_correctly(
    student_factory, variant_factory, room_factory
):
    """3000 / 3 = 1000.00 exact. 1000 / 3 = 333.33."""
    variant = variant_factory(total_price=Decimal("1000"), min_occupancy=1, max_occupancy=3)
    room = room_factory(variant=variant)
    ama = student_factory()

    booking = create_booking(student=ama, room=room, chosen_occupancy=3)
    assert booking.price_paid == Decimal("333.33")
