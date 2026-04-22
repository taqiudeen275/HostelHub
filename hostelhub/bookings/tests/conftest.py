"""Shared fixtures for booking tests."""
from decimal import Decimal

import pytest

from accounts.models import User, UserRole
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
        phone="+233244000001",
        role=UserRole.HOSTEL_ADMIN,
        is_verified=True,
    )


@pytest.fixture
def student_factory(db):
    counter = {"n": 0}

    def make(phone=None, **kwargs):
        counter["n"] += 1
        return User.objects.create_user(
            phone=phone or f"+23324490{counter['n']:04d}",
            role=UserRole.STUDENT,
            is_verified=True,
            **kwargs,
        )

    return make


@pytest.fixture
def hostel(owner):
    return Hostel.objects.create(
        owner=owner,
        name="Test Hostel",
        description="A hostel used for booking tests.",
        address_text="KNUST, Kumasi",
        gender_policy=GenderPolicy.MIXED,
        owner_contact_phone="+233244000001",
        status=HostelStatus.APPROVED,
    )


@pytest.fixture
def variant_factory(hostel):
    def make(
        name="Standard Double",
        total_price=Decimal("3000.00"),
        min_occupancy=1,
        max_occupancy=2,
    ):
        return RoomVariant.objects.create(
            hostel=hostel,
            name=name,
            description=f"{name} variant.",
            total_price=total_price,
            min_occupancy=min_occupancy,
            max_occupancy=max_occupancy,
        )

    return make


@pytest.fixture
def room_factory(variant_factory):
    counter = {"n": 0}

    def make(variant=None, label=None, status=RoomStatus.AVAILABLE):
        counter["n"] += 1
        v = variant or variant_factory()
        return Room.objects.create(
            variant=v,
            label=label or f"R{counter['n']}",
            status=status,
        )

    return make
