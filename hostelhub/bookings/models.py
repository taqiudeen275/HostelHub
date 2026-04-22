"""Booking models. Implements the booking lifecycle described in PRD §6–§9."""
import uuid

from django.conf import settings
from django.db import models


class BookingStatus(models.TextChoices):
    PENDING_PAYMENT = "PENDING_PAYMENT", "Pending Payment"
    CONFIRMED = "CONFIRMED", "Confirmed"
    CHECKED_IN = "CHECKED_IN", "Checked In"
    CHECKED_OUT = "CHECKED_OUT", "Checked Out"
    CANCELLED = "CANCELLED", "Cancelled"
    EXPIRED = "EXPIRED", "Expired"
    REFUNDED = "REFUNDED", "Refunded"


# Statuses that count against a room's occupancy — i.e. these bookings are
# actively holding a slot. EXPIRED/CANCELLED/REFUNDED release the slot.
ACTIVE_BOOKING_STATUSES = (
    BookingStatus.PENDING_PAYMENT,
    BookingStatus.CONFIRMED,
    BookingStatus.CHECKED_IN,
    BookingStatus.CHECKED_OUT,
)

# Statuses that definitively contribute to `locked_k` on the Room.
# PENDING_PAYMENT also holds the slot but releases automatically on expiry.
CONFIRMED_BOOKING_STATUSES = (
    BookingStatus.CONFIRMED,
    BookingStatus.CHECKED_IN,
    BookingStatus.CHECKED_OUT,
)


class Booking(models.Model):
    """
    A student's claim on a slot within a Room. The first booker of a Room sets
    `chosen_occupancy_at_booking`, which is echoed into Room.locked_k; later
    bookers inherit that value.

    See PRD §9 for the full shared-occupancy pricing logic.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="bookings",
    )
    room = models.ForeignKey(
        "hostels.Room",
        on_delete=models.PROTECT,
        related_name="bookings",
    )
    chosen_occupancy_at_booking = models.PositiveSmallIntegerField()
    price_paid = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=BookingStatus.choices,
        default=BookingStatus.PENDING_PAYMENT,
    )
    # Populated while status = PENDING_PAYMENT; nulled once confirmed.
    reservation_expires_at = models.DateTimeField(null=True, blank=True)

    # Optional admin-set expected check-in date. If set, the check_in_reminder
    # scheduled task SMS's the student the day before. Null = no reminder.
    expected_check_in = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "bookings_booking"
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["room", "status"]),
            models.Index(fields=["status", "reservation_expires_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"Booking({self.student.phone} → {self.room.label}, {self.status})"

    @property
    def is_active(self):
        return self.status in ACTIVE_BOOKING_STATUSES

    @property
    def hostel(self):
        """Convenience accessor — hostel is reachable via room.variant.hostel."""
        return self.room.variant.hostel
