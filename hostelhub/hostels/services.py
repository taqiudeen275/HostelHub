"""Hostel-side domain services used by M4 bookings."""
from django.db import transaction

from .models import Room, RoomVariant


@transaction.atomic
def update_variant_max_occupancy(variant: RoomVariant, *, new_max: int) -> RoomVariant:
    """
    Safely change a variant's max_occupancy. Per PRD §9.4: only allowed if no
    room currently has locked_k > new_max, since we can't break existing bookings.
    """
    if new_max < variant.min_occupancy:
        raise ValueError(
            f"new max ({new_max}) cannot be below min_occupancy "
            f"({variant.min_occupancy})."
        )
    conflicting = Room.objects.filter(variant=variant, locked_k__gt=new_max).exists()
    if conflicting:
        raise ValueError(
            "Cannot reduce max_occupancy below locked k of an active room."
        )
    variant.max_occupancy = new_max
    variant.save(update_fields=["max_occupancy"])
    return variant
