"""Check-in reminder scheduled task."""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from accounts.models import User, UserRole
from bookings.models import Booking, BookingStatus
from bookings.tasks import send_check_in_reminders_task
from hostels.models import (
    GenderPolicy,
    Hostel,
    HostelStatus,
    Room,
    RoomVariant,
)
from notifications.models import SMSMessage


pytestmark = pytest.mark.django_db


@pytest.fixture
def booking_factory(db):
    owner = User.objects.create_user(
        phone="+233244800001", role=UserRole.HOSTEL_ADMIN, is_verified=True
    )
    hostel = Hostel.objects.create(
        owner=owner, name="Unity", description="",
        address_text="KNUST", gender_policy=GenderPolicy.MIXED,
        owner_contact_phone="+233244800001", status=HostelStatus.APPROVED,
    )
    variant = RoomVariant.objects.create(
        hostel=hostel, name="Single", description="",
        total_price=Decimal("3000"), min_occupancy=1, max_occupancy=1,
    )
    counter = {"n": 0}

    def make(*, check_in=None, status=BookingStatus.CONFIRMED):
        counter["n"] += 1
        # Start phone counter at 100 to avoid colliding with owner phone (+233244800001)
        student = User.objects.create_user(
            phone=f"+2332448001{counter['n']:02d}",
            role=UserRole.STUDENT, is_verified=True,
        )
        room = Room.objects.create(variant=variant, label=f"R{counter['n']}", locked_k=1)
        return Booking.objects.create(
            student=student, room=room, chosen_occupancy_at_booking=1,
            price_paid=Decimal("3000"), status=status,
            expected_check_in=check_in,
        )

    return make


def test_reminder_fires_for_bookings_due_tomorrow(booking_factory):
    tomorrow = timezone.localdate() + timedelta(days=1)
    b = booking_factory(check_in=tomorrow)

    sent = send_check_in_reminders_task()
    assert sent == 1
    assert SMSMessage.objects.filter(
        template_key="check_in_reminder",
        to_phone=b.student.phone,
    ).exists()


def test_reminder_skips_bookings_with_null_check_in(booking_factory):
    booking_factory(check_in=None)
    sent = send_check_in_reminders_task()
    assert sent == 0


def test_reminder_skips_bookings_due_further_out(booking_factory):
    booking_factory(check_in=timezone.localdate() + timedelta(days=5))
    sent = send_check_in_reminders_task()
    assert sent == 0


def test_reminder_skips_cancelled_bookings(booking_factory):
    booking_factory(
        check_in=timezone.localdate() + timedelta(days=1),
        status=BookingStatus.CANCELLED,
    )
    sent = send_check_in_reminders_task()
    assert sent == 0


def test_reminder_is_idempotent_same_day(booking_factory):
    tomorrow = timezone.localdate() + timedelta(days=1)
    booking_factory(check_in=tomorrow)

    assert send_check_in_reminders_task() == 1
    assert send_check_in_reminders_task() == 0  # already sent today
    assert SMSMessage.objects.filter(template_key="check_in_reminder").count() == 1
