"""Booking HTTP endpoints."""
import logging

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from accounts.permissions import IsHostelAdmin, IsStudent
from hostels.models import Room

from . import services
from .exceptions import (
    BookingError,
    BookingNotCancellableError,
    HostelNotApprovedError,
    InvalidOccupancyError,
    RoomFullError,
    RoomUnavailableError,
)
from .models import ACTIVE_BOOKING_STATUSES, Booking, BookingStatus
from .serializers import (
    BookingCancelSerializer,
    BookingCreateResponseSerializer,
    BookingCreateSerializer,
    BookingSerializer,
)


logger = logging.getLogger(__name__)


def _booking_visible_to(booking: Booking, user) -> bool:
    """A booking is visible to its student, to the hostel admin who owns the hostel, or to super admins."""
    if user.role == UserRole.SUPER_ADMIN:
        return True
    if user.role == UserRole.STUDENT and booking.student_id == user.id:
        return True
    if user.role == UserRole.HOSTEL_ADMIN and booking.room.variant.hostel.owner_id == user.id:
        return True
    return False


class BookingListCreateView(APIView):
    """
    GET  /api/v1/bookings/          → student sees own bookings; admins see theirs
    POST /api/v1/bookings/          → student creates a booking (PENDING_PAYMENT + Paystack init)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = Booking.objects.select_related("room__variant__hostel", "student").prefetch_related("payments")

        if user.role == UserRole.STUDENT:
            qs = qs.filter(student=user)
        elif user.role == UserRole.HOSTEL_ADMIN:
            qs = qs.filter(room__variant__hostel__owner=user)
        elif user.role != UserRole.SUPER_ADMIN:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # Optional filters
        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        active_only = request.query_params.get("active") == "true"
        if active_only:
            qs = qs.filter(status__in=ACTIVE_BOOKING_STATUSES)

        qs = qs.order_by("-created_at")
        serializer = BookingSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        if request.user.role != UserRole.STUDENT:
            return Response(
                {"error": "Only students can create bookings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        room = get_object_or_404(
            Room.objects.select_related("variant__hostel"),
            pk=serializer.validated_data["room_id"],
        )

        try:
            booking = services.create_booking(
                student=request.user,
                room=room,
                chosen_occupancy=serializer.validated_data["chosen_occupancy"],
            )
        except (InvalidOccupancyError, RoomUnavailableError, HostelNotApprovedError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except RoomFullError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
        except BookingError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # Initialize Paystack inline so the frontend gets the redirect URL in one call.
        from payments.services import initialize_payment
        from payments.adapters.paystack import PaystackError

        try:
            payment, authorization_url = initialize_payment(booking)
        except PaystackError as exc:
            logger.error("Payment init failed for booking %s: %s", booking.id, exc)
            # Release the slot we just claimed — the student can't pay.
            services.cancel_booking(booking)
            return Response(
                {"error": "Could not start payment session. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        booking.refresh_from_db()
        response_data = {
            "booking": BookingSerializer(booking).data,
            "authorization_url": authorization_url,
            "payment_reference": payment.paystack_reference,
        }
        return Response(response_data, status=status.HTTP_201_CREATED)


class BookingDetailView(APIView):
    """GET /api/v1/bookings/{id}/ — owner or hostel admin only."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        booking = get_object_or_404(
            Booking.objects.select_related("room__variant__hostel", "student").prefetch_related("payments"),
            pk=pk,
        )
        if not _booking_visible_to(booking, request.user):
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        return Response(BookingSerializer(booking).data)


class BookingCancelView(APIView):
    """POST /api/v1/bookings/{id}/cancel/ — student-initiated."""
    permission_classes = [IsStudent]

    def post(self, request, pk):
        booking = get_object_or_404(Booking, pk=pk, student=request.user)
        serializer = BookingCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            booking = services.cancel_booking(booking)
        except BookingNotCancellableError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(BookingSerializer(booking).data)


class BookingCheckInView(APIView):
    """POST /api/v1/bookings/{id}/check-in/ — hostel admin of that hostel only."""
    permission_classes = [IsHostelAdmin]

    def post(self, request, pk):
        booking = get_object_or_404(
            Booking.objects.select_related("room__variant__hostel"), pk=pk
        )
        if booking.room.variant.hostel.owner_id != request.user.id:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        try:
            booking = services.check_in(booking)
        except BookingError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(BookingSerializer(booking).data)


class BookingCheckOutView(APIView):
    """POST /api/v1/bookings/{id}/check-out/ — hostel admin of that hostel only."""
    permission_classes = [IsHostelAdmin]

    def post(self, request, pk):
        booking = get_object_or_404(
            Booking.objects.select_related("room__variant__hostel"), pk=pk
        )
        if booking.room.variant.hostel.owner_id != request.user.id:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        try:
            booking = services.check_out(booking)
        except BookingError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(BookingSerializer(booking).data)
