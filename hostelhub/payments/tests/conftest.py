"""Shared fixtures for payment tests. Reuses the booking fixtures."""
from decimal import Decimal

import pytest

from accounts.models import User, UserRole
from bookings.services import create_booking
from hostels.models import (
    GenderPolicy,
    Hostel,
    HostelStatus,
    Room,
    RoomVariant,
)


@pytest.fixture
def owner(db):
    return User.objects.create_user(
        phone="+233244500001",
        role=UserRole.HOSTEL_ADMIN,
        is_verified=True,
    )


@pytest.fixture
def student(db):
    return User.objects.create_user(
        phone="+233244500002",
        role=UserRole.STUDENT,
        is_verified=True,
        email="student@test.local",
    )


@pytest.fixture
def approved_hostel(owner):
    return Hostel.objects.create(
        owner=owner,
        name="Payments Test Hostel",
        description="Fixture hostel for payment tests.",
        address_text="KNUST",
        gender_policy=GenderPolicy.MIXED,
        owner_contact_phone="+233244500001",
        status=HostelStatus.APPROVED,
    )


@pytest.fixture
def variant(approved_hostel):
    return RoomVariant.objects.create(
        hostel=approved_hostel,
        name="Single",
        description="A room.",
        total_price=Decimal("3000"),
        min_occupancy=1,
        max_occupancy=1,
    )


@pytest.fixture
def room(variant):
    return Room.objects.create(variant=variant, label="A1")


@pytest.fixture
def pending_booking(student, room):
    return create_booking(student=student, room=room, chosen_occupancy=1)
