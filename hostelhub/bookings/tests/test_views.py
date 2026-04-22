"""HTTP-level tests for booking endpoints."""
from decimal import Decimal
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User, UserRole
from bookings.models import Booking, BookingStatus
from hostels.models import RoomStatus


pytestmark = pytest.mark.django_db


def _auth(user):
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


@pytest.fixture
def fake_paystack():
    """Patch Paystack out so no network calls happen in view tests."""
    with patch("payments.services.get_paystack_adapter") as get_adapter:
        fake = get_adapter.return_value
        fake.initialize.return_value = {
            "authorization_url": "https://checkout.paystack.com/fake",
            "access_code": "fake",
            "reference": "HH-TEST",
        }
        yield fake


# ─── POST /bookings/ ──────────────────────────────────────────────────────────


def test_create_booking_happy_path(student_factory, variant_factory, room_factory, fake_paystack):
    variant = variant_factory(total_price=Decimal("3000"), min_occupancy=1, max_occupancy=2)
    room = room_factory(variant=variant)
    ama = student_factory()

    client = _auth(ama)
    res = client.post(
        "/api/v1/bookings/",
        {"room_id": str(room.id), "chosen_occupancy": 2},
        format="json",
    )
    assert res.status_code == 201
    assert "authorization_url" in res.data
    assert res.data["booking"]["status"] == BookingStatus.PENDING_PAYMENT
    assert res.data["booking"]["price_paid"] == "1500.00"


def test_create_booking_requires_student(owner, variant_factory, room_factory):
    variant = variant_factory()
    room = room_factory(variant=variant)
    client = _auth(owner)
    res = client.post(
        "/api/v1/bookings/",
        {"room_id": str(room.id), "chosen_occupancy": 1},
        format="json",
    )
    assert res.status_code == 403


def test_create_booking_invalid_occupancy(student_factory, variant_factory, room_factory):
    variant = variant_factory(min_occupancy=2, max_occupancy=4)
    room = room_factory(variant=variant)
    ama = student_factory()
    client = _auth(ama)
    res = client.post(
        "/api/v1/bookings/",
        {"room_id": str(room.id), "chosen_occupancy": 1},
        format="json",
    )
    assert res.status_code == 400


def test_create_booking_room_full_returns_409(
    student_factory, variant_factory, room_factory, fake_paystack
):
    variant = variant_factory(min_occupancy=1, max_occupancy=1)
    room = room_factory(variant=variant)
    ama = student_factory()
    kwame = student_factory()

    c1 = _auth(ama)
    c1.post(
        "/api/v1/bookings/", {"room_id": str(room.id), "chosen_occupancy": 1}, format="json"
    )

    c2 = _auth(kwame)
    res = c2.post(
        "/api/v1/bookings/", {"room_id": str(room.id), "chosen_occupancy": 1}, format="json"
    )
    assert res.status_code == 409


# ─── GET /bookings/ ──────────────────────────────────────────────────────────


def test_list_bookings_student_sees_own(student_factory, variant_factory, room_factory):
    variant = variant_factory()
    room = room_factory(variant=variant)
    ama = student_factory()
    kwame = student_factory()

    Booking.objects.create(
        student=ama, room=room, chosen_occupancy_at_booking=1,
        price_paid=Decimal("3000"), status=BookingStatus.CONFIRMED,
    )

    client = _auth(kwame)
    res = client.get("/api/v1/bookings/")
    assert res.status_code == 200
    assert res.data == []  # Kwame has none of his own

    client = _auth(ama)
    res = client.get("/api/v1/bookings/")
    assert len(res.data) == 1


def test_list_bookings_hostel_admin_sees_own_hostels(
    student_factory, variant_factory, room_factory, owner
):
    variant = variant_factory()
    room = room_factory(variant=variant)
    ama = student_factory()

    Booking.objects.create(
        student=ama, room=room, chosen_occupancy_at_booking=1,
        price_paid=Decimal("3000"), status=BookingStatus.CONFIRMED,
    )
    client = _auth(owner)
    res = client.get("/api/v1/bookings/")
    assert res.status_code == 200
    assert len(res.data) == 1


# ─── Cancel ───────────────────────────────────────────────────────────────────


def test_cancel_own_booking(student_factory, variant_factory, room_factory, fake_paystack):
    variant = variant_factory(min_occupancy=1, max_occupancy=2)
    room = room_factory(variant=variant)
    ama = student_factory()
    client = _auth(ama)
    res = client.post(
        "/api/v1/bookings/", {"room_id": str(room.id), "chosen_occupancy": 2}, format="json"
    )
    assert res.status_code == 201
    booking_id = res.data["booking"]["id"]

    cancel_res = client.post(f"/api/v1/bookings/{booking_id}/cancel/", format="json")
    assert cancel_res.status_code == 200
    assert cancel_res.data["status"] == BookingStatus.CANCELLED
    room.refresh_from_db()
    assert room.locked_k is None
    assert room.status == RoomStatus.AVAILABLE


def test_cannot_cancel_another_students_booking(
    student_factory, variant_factory, room_factory, fake_paystack
):
    variant = variant_factory()
    room = room_factory(variant=variant)
    ama = student_factory()
    kwame = student_factory()

    ama_client = _auth(ama)
    res = ama_client.post(
        "/api/v1/bookings/", {"room_id": str(room.id), "chosen_occupancy": 1}, format="json"
    )
    booking_id = res.data["booking"]["id"]

    kwame_client = _auth(kwame)
    cancel_res = kwame_client.post(f"/api/v1/bookings/{booking_id}/cancel/", format="json")
    # Kwame's request hits `student=request.user` filter → 404
    assert cancel_res.status_code == 404


# ─── Check in / check out ─────────────────────────────────────────────────────


def test_hostel_admin_can_check_in_confirmed_booking(
    student_factory, variant_factory, room_factory, owner
):
    variant = variant_factory()
    room = room_factory(variant=variant)
    ama = student_factory()
    b = Booking.objects.create(
        student=ama, room=room, chosen_occupancy_at_booking=1,
        price_paid=Decimal("3000"), status=BookingStatus.CONFIRMED,
    )
    client = _auth(owner)
    res = client.post(f"/api/v1/bookings/{b.id}/check-in/", format="json")
    assert res.status_code == 200
    b.refresh_from_db()
    assert b.status == BookingStatus.CHECKED_IN


def test_other_hostel_admin_cannot_check_in(
    student_factory, variant_factory, room_factory
):
    variant = variant_factory()
    room = room_factory(variant=variant)
    ama = student_factory()
    other_admin = User.objects.create_user(
        phone="+233244111999", role=UserRole.HOSTEL_ADMIN, is_verified=True
    )
    b = Booking.objects.create(
        student=ama, room=room, chosen_occupancy_at_booking=1,
        price_paid=Decimal("3000"), status=BookingStatus.CONFIRMED,
    )
    client = _auth(other_admin)
    res = client.post(f"/api/v1/bookings/{b.id}/check-in/", format="json")
    assert res.status_code == 403


def test_check_out_requires_checked_in_state(
    student_factory, variant_factory, room_factory, owner
):
    variant = variant_factory()
    room = room_factory(variant=variant)
    ama = student_factory()
    b = Booking.objects.create(
        student=ama, room=room, chosen_occupancy_at_booking=1,
        price_paid=Decimal("3000"), status=BookingStatus.CONFIRMED,
    )
    client = _auth(owner)
    res = client.post(f"/api/v1/bookings/{b.id}/check-out/", format="json")
    assert res.status_code == 409  # Must check in first
