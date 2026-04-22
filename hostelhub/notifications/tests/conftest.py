"""Shared fixtures for notifications tests."""
from decimal import Decimal

import pytest

from accounts.models import User, UserRole
from bookings.models import Booking, BookingStatus
from hostels.models import (
    GenderPolicy,
    Hostel,
    HostelStatus,
    Room,
    RoomStatus,
    RoomVariant,
)


@pytest.fixture
def owner(db):
    return User.objects.create_user(
        phone="+233244600001",
        role=UserRole.HOSTEL_ADMIN,
        is_verified=True,
    )


@pytest.fixture
def other_owner(db):
    return User.objects.create_user(
        phone="+233244600002",
        role=UserRole.HOSTEL_ADMIN,
        is_verified=True,
    )


@pytest.fixture
def approved_hostel(owner):
    return Hostel.objects.create(
        owner=owner,
        name="Unity Hall",
        description="fixture hostel",
        address_text="KNUST",
        gender_policy=GenderPolicy.MIXED,
        owner_contact_phone="+233244600001",
        status=HostelStatus.APPROVED,
    )


@pytest.fixture
def room(approved_hostel):
    variant = RoomVariant.objects.create(
        hostel=approved_hostel,
        name="Standard Double",
        description="Double room",
        total_price=Decimal("3000"),
        min_occupancy=1,
        max_occupancy=2,
    )
    return Room.objects.create(variant=variant, label="R1", status=RoomStatus.PARTIALLY_BOOKED, locked_k=2)


@pytest.fixture
def student_factory(db):
    counter = {"n": 0}

    def make(**kwargs):
        counter["n"] += 1
        return User.objects.create_user(
            phone=f"+23324490{counter['n']:04d}",
            role=UserRole.STUDENT,
            is_verified=True,
            **kwargs,
        )

    return make


@pytest.fixture
def confirmed_booking(room, student_factory):
    student = student_factory()
    return Booking.objects.create(
        student=student,
        room=room,
        chosen_occupancy_at_booking=2,
        price_paid=Decimal("1500"),
        status=BookingStatus.CONFIRMED,
    )
