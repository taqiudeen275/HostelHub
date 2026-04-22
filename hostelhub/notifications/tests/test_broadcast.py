"""SMS broadcast endpoint — audience + preview + send + rate limit."""
from decimal import Decimal
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User, UserRole
from bookings.models import Booking, BookingStatus
from hostels.models import (
    GenderPolicy,
    Hostel,
    HostelStatus,
    Room,
    RoomVariant,
)
from notifications.models import SMSMessage


pytestmark = pytest.mark.django_db


def _auth(user):
    client = APIClient()
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}"
    )
    return client


@pytest.fixture(autouse=True)
def _reset_throttle_cache():
    """Clear DRF's throttle cache between tests so the rate limit doesn't bleed across cases."""
    from django.core.cache import cache
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def owner(db):
    return User.objects.create_user(
        phone="+233244900001", role=UserRole.HOSTEL_ADMIN, is_verified=True
    )


@pytest.fixture
def approved_hostel(owner):
    return Hostel.objects.create(
        owner=owner,
        name="Unity Hall",
        description="fixture",
        address_text="KNUST",
        gender_policy=GenderPolicy.MIXED,
        owner_contact_phone="+233244900001",
        status=HostelStatus.APPROVED,
    )


@pytest.fixture
def populated_hostel(approved_hostel):
    """Hostel with one variant, one room, and 2 confirmed + 1 pending bookings."""
    variant = RoomVariant.objects.create(
        hostel=approved_hostel,
        name="Double",
        description="",
        total_price=Decimal("3000"),
        min_occupancy=1,
        max_occupancy=2,
    )
    room = Room.objects.create(variant=variant, label="R1", locked_k=2)

    def student(phone):
        return User.objects.create_user(
            phone=phone, role=UserRole.STUDENT, is_verified=True
        )

    ama = student("+233244900100")
    kwame = student("+233244900101")
    akos = student("+233244900102")

    Booking.objects.create(
        student=ama, room=room, chosen_occupancy_at_booking=2,
        price_paid=Decimal("1500"), status=BookingStatus.CONFIRMED,
    )
    Booking.objects.create(
        student=kwame, room=room, chosen_occupancy_at_booking=2,
        price_paid=Decimal("1500"), status=BookingStatus.CHECKED_IN,
    )
    # Pending doesn't count as audience
    Booking.objects.create(
        student=akos, room=room, chosen_occupancy_at_booking=2,
        price_paid=Decimal("1500"), status=BookingStatus.PENDING_PAYMENT,
    )
    return approved_hostel


def test_preview_counts_only_active_bookings(owner, populated_hostel):
    client = _auth(owner)
    res = client.get(
        f"/api/v1/admin/hostels/{populated_hostel.id}/sms-broadcast/preview/",
        {"message": "Water off Saturday."},
    )
    assert res.status_code == 200
    assert res.data["audience_count"] == 2
    assert res.data["segments"] == 1
    # 0.10 * 1 segment * 2 recipients = 0.20
    assert res.data["estimated_cost_ghs"] == "0.20"


def test_broadcast_sends_one_sms_per_active_booker(owner, populated_hostel):
    # Bypass Q — call the inline fallback synchronously.
    with patch("notifications.services.async_task", None):
        client = _auth(owner)
        res = client.post(
            f"/api/v1/admin/hostels/{populated_hostel.id}/sms-broadcast/",
            {"message": "Reminder: check-in Friday."},
            format="json",
        )
    assert res.status_code == 202
    assert res.data["audience_count"] == 2

    rows = SMSMessage.objects.filter(template_key="custom_broadcast")
    assert rows.count() == 2
    assert {r.to_phone for r in rows} == {"+233244900100", "+233244900101"}
    assert all(r.status == "SENT" for r in rows)
    assert all("check-in Friday" in r.body for r in rows)


def test_broadcast_rejects_long_message(owner, populated_hostel):
    client = _auth(owner)
    res = client.post(
        f"/api/v1/admin/hostels/{populated_hostel.id}/sms-broadcast/",
        {"message": "a" * 460},
        format="json",
    )
    assert res.status_code == 400


def test_broadcast_rejects_empty_message(owner, populated_hostel):
    client = _auth(owner)
    res = client.post(
        f"/api/v1/admin/hostels/{populated_hostel.id}/sms-broadcast/",
        {"message": "   "},
        format="json",
    )
    assert res.status_code == 400


def test_broadcast_rate_limited_to_three_per_hour(owner, populated_hostel):
    client = _auth(owner)
    with patch("notifications.services.async_task", None):
        for _ in range(3):
            res = client.post(
                f"/api/v1/admin/hostels/{populated_hostel.id}/sms-broadcast/",
                {"message": "hi"},
                format="json",
            )
            assert res.status_code == 202
        # 4th call → 429
        res = client.post(
            f"/api/v1/admin/hostels/{populated_hostel.id}/sms-broadcast/",
            {"message": "hi"},
            format="json",
        )
    assert res.status_code == 429


def test_other_admin_cannot_broadcast_to_hostel_they_dont_own(populated_hostel, db):
    other = User.objects.create_user(
        phone="+233244999999", role=UserRole.HOSTEL_ADMIN, is_verified=True
    )
    client = _auth(other)
    res = client.post(
        f"/api/v1/admin/hostels/{populated_hostel.id}/sms-broadcast/",
        {"message": "hi"},
        format="json",
    )
    assert res.status_code == 403
