"""Privacy-aware roommates endpoint."""
from decimal import Decimal

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import PrivacyChoice, StudentProfile, User, UserRole
from bookings.models import Booking, BookingStatus
from hostels.models import (
    GenderPolicy,
    Hostel,
    HostelStatus,
    Room,
    RoomVariant,
)


pytestmark = pytest.mark.django_db


def _auth(user):
    client = APIClient()
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}"
    )
    return client


def _make_student(phone, first="Ama", last="Mensah", **profile_kwargs):
    user = User.objects.create_user(
        phone=phone, role=UserRole.STUDENT, is_verified=True,
        first_name=first, last_name=last,
    )
    StudentProfile.objects.create(
        user=user,
        program=profile_kwargs.pop("program", "Computer Science"),
        level=profile_kwargs.pop("level", "300"),
        **profile_kwargs,
    )
    return user


@pytest.fixture
def hostel(db):
    owner = User.objects.create_user(
        phone="+233244700001", role=UserRole.HOSTEL_ADMIN, is_verified=True
    )
    return Hostel.objects.create(
        owner=owner, name="Unity", description="",
        address_text="KNUST", gender_policy=GenderPolicy.MIXED,
        owner_contact_phone="+233244700001", status=HostelStatus.APPROVED,
    )


@pytest.fixture
def variant(hostel):
    return RoomVariant.objects.create(
        hostel=hostel, name="Double", description="",
        total_price=Decimal("3000"), min_occupancy=1, max_occupancy=2,
    )


@pytest.fixture
def room_a(variant):
    return Room.objects.create(variant=variant, label="A", locked_k=2)


@pytest.fixture
def room_b(variant):
    return Room.objects.create(variant=variant, label="B", locked_k=2)


def _book(student, room, status=BookingStatus.CONFIRMED):
    return Booking.objects.create(
        student=student, room=room, chosen_occupancy_at_booking=2,
        price_paid=Decimal("1500"), status=status,
    )


def test_same_room_roommate_visible_with_privacy_roommates(room_a):
    ama = _make_student("+233244700100", first="Ama")
    kwame = _make_student(
        "+233244700101", first="Kwame", last="Owusu",
        privacy_phone=PrivacyChoice.ROOMMATES,
        privacy_full_name=PrivacyChoice.ROOMMATES,
    )
    _book(ama, room_a)
    _book(kwame, room_a)

    client = _auth(ama)
    res = client.get(f"/api/v1/bookings/{ama.bookings.first().id}/roommates/")
    assert res.status_code == 200
    assert len(res.data["roommates"]) == 1
    card = res.data["roommates"][0]
    assert card["first_name"] == "Kwame"
    assert card["last_name"] == "Owusu"
    assert card["phone"] == "+233244700101"


def test_nobody_privacy_hides_field(room_a):
    ama = _make_student("+233244700110")
    kwame = _make_student(
        "+233244700111", first="Kwame", last="Owusu",
        privacy_phone=PrivacyChoice.NOBODY,
        privacy_full_name=PrivacyChoice.NOBODY,
    )
    _book(ama, room_a)
    _book(kwame, room_a)

    client = _auth(ama)
    res = client.get(f"/api/v1/bookings/{ama.bookings.first().id}/roommates/")
    card = res.data["roommates"][0]
    assert card["first_name"] == "Kwame"  # always visible
    assert card["last_name"] is None
    assert card["phone"] is None


def test_pending_payment_not_in_roommate_list(room_a):
    ama = _make_student("+233244700120")
    kwame = _make_student("+233244700121")
    _book(ama, room_a)
    _book(kwame, room_a, status=BookingStatus.PENDING_PAYMENT)

    client = _auth(ama)
    res = client.get(f"/api/v1/bookings/{ama.bookings.first().id}/roommates/")
    assert res.data["roommates"] == []


def test_slots_open_reflects_available_capacity(room_a):
    ama = _make_student("+233244700130")
    _book(ama, room_a)
    # locked_k=2, one active booking → 1 slot open

    client = _auth(ama)
    res = client.get(f"/api/v1/bookings/{ama.bookings.first().id}/roommates/")
    assert res.data["slots_open"] == 1


def test_admin_sees_unfiltered_roommate(room_a, hostel):
    ama = _make_student("+233244700140")
    kwame = _make_student(
        "+233244700141", first="Kwame", last="Owusu",
        privacy_phone=PrivacyChoice.NOBODY,
        privacy_full_name=PrivacyChoice.NOBODY,
    )
    _book(ama, room_a)
    _book(kwame, room_a)

    client = _auth(hostel.owner)
    res = client.get(f"/api/v1/bookings/{ama.bookings.first().id}/roommates/")
    card = res.data["roommates"][0]
    # Admin bypass — even NOBODY-privacy fields visible
    assert card["last_name"] == "Owusu"
    assert card["phone"] == "+233244700141"


def test_stranger_cannot_access_roommates(room_a, db):
    ama = _make_student("+233244700150")
    _book(ama, room_a)
    stranger = _make_student("+233244700151")

    client = _auth(stranger)
    res = client.get(f"/api/v1/bookings/{ama.bookings.first().id}/roommates/")
    assert res.status_code == 403
