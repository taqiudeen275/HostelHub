"""Roommates endpoint — privacy-aware co-occupant list (PRD §FR-7)."""
from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import PrivacyChoice, UserRole
from .models import Booking, BookingStatus


# Only confirmed / checked-in / checked-out count as a real roommate (per spec).
ROOMMATE_STATUSES = (
    BookingStatus.CONFIRMED,
    BookingStatus.CHECKED_IN,
    BookingStatus.CHECKED_OUT,
)


def _viewer_scope(viewer, room) -> str:
    """
    Return the viewer's relationship to the roommate's room for privacy checks.
    "roommate" → viewer has an active booking on the *same* room.
    "hostelmate" → viewer has an active booking on any room in the same hostel.
    "outsider" → none of the above.
    """
    hostel_id = room.variant.hostel_id
    viewer_active = Booking.objects.filter(
        student=viewer,
        status__in=ROOMMATE_STATUSES,
    ).select_related("room__variant__hostel")
    for b in viewer_active:
        if b.room_id == room.id:
            return "roommate"
        if b.room.variant.hostel_id == hostel_id:
            return "hostelmate"
    return "outsider"


def _is_visible(privacy: str, scope: str) -> bool:
    """Evaluate a single privacy field against a viewer's scope."""
    if privacy == PrivacyChoice.NOBODY:
        return False
    if privacy == PrivacyChoice.ROOMMATES:
        return scope == "roommate"
    if privacy == PrivacyChoice.HOSTELMATES:
        return scope in ("roommate", "hostelmate")
    return False


def _serialize_roommate(booking: Booking, scope: str, unfiltered: bool = False) -> dict:
    """Build a roommate card, applying the roommate's privacy settings to fields."""
    student = booking.student
    profile = getattr(student, "student_profile", None)

    card = {
        "booking_id": str(booking.id),
        "status": booking.status,
        "first_name": student.first_name or "",
        "program": getattr(profile, "program", "") if profile else "",
        "level": getattr(profile, "level", "") if profile else "",
        "last_name": None,
        "full_name": None,
        "phone": None,
        "profile_photo": None,
    }

    show_last_name = unfiltered
    show_phone = unfiltered
    show_photo = unfiltered

    if profile and not unfiltered:
        show_last_name = _is_visible(profile.privacy_full_name, scope)
        show_phone = _is_visible(profile.privacy_phone, scope)
        show_photo = _is_visible(profile.privacy_photo, scope)

    if show_last_name and student.last_name:
        card["last_name"] = student.last_name
        card["full_name"] = f"{student.first_name} {student.last_name}".strip()
    if show_phone:
        card["phone"] = student.phone
    if show_photo and profile and profile.profile_photo:
        card["profile_photo"] = profile.profile_photo.url

    return card


class RoommatesView(APIView):
    """
    GET /api/v1/bookings/{booking_id}/roommates/

    Returns the other confirmed occupants of the same Room, with each field
    filtered by the roommate's own privacy settings. Super admins and the
    hostel's admin get unfiltered data (FR-8).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        booking = get_object_or_404(
            Booking.objects.select_related("room__variant__hostel", "student"),
            pk=pk,
        )
        user = request.user

        # Authorization: owner, super admin, or owning hostel admin.
        is_owner = booking.student_id == user.id
        is_super = user.role == UserRole.SUPER_ADMIN
        is_hostel_admin = (
            user.role == UserRole.HOSTEL_ADMIN
            and booking.room.variant.hostel.owner_id == user.id
        )
        if not (is_owner or is_super or is_hostel_admin):
            return Response(
                {"error": "Forbidden."}, status=status.HTTP_403_FORBIDDEN
            )

        room = booking.room
        # Exclude the booking's own student — admins shouldn't see themselves
        # counted as a roommate of the student they're inspecting either.
        co_occupants = (
            Booking.objects.filter(room=room, status__in=ROOMMATE_STATUSES)
            .exclude(student_id=booking.student_id)
            .select_related("student__student_profile")
        )

        unfiltered = is_super or is_hostel_admin
        scope = "roommate" if is_owner else "roommate"
        # Admins see unfiltered anyway, so scope isn't used for them.
        roommates = [
            _serialize_roommate(b, scope, unfiltered=unfiltered) for b in co_occupants
        ]

        locked_k = room.locked_k or 0
        active_count = Booking.objects.filter(
            room=room,
            status__in=(
                BookingStatus.PENDING_PAYMENT,
                BookingStatus.CONFIRMED,
                BookingStatus.CHECKED_IN,
                BookingStatus.CHECKED_OUT,
            ),
        ).count()
        slots_open = max(0, locked_k - active_count)

        return Response({
            "booking_id": str(booking.id),
            "room": {
                "id": str(room.id),
                "label": room.label,
                "locked_k": room.locked_k,
            },
            "hostel": {
                "id": str(room.variant.hostel_id),
                "name": room.variant.hostel.name,
            },
            "slots_open": slots_open,
            "roommates": roommates,
        })
