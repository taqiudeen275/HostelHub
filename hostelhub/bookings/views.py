"""Booking HTTP endpoints."""
import logging
from datetime import date

from django.db.models import Count, Q, Sum
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


class AdminDashboardStatsView(APIView):
    """GET /api/v1/bookings/admin-stats/ — aggregated stats for hostel admin."""
    permission_classes = [IsHostelAdmin]

    def get(self, request):
        from hostels.models import Hostel, Room

        user = request.user
        hostels = Hostel.objects.filter(owner=user)

        # Optional filter to a single hostel
        hostel_id = request.query_params.get("hostel_id")
        if hostel_id:
            hostels = hostels.filter(pk=hostel_id)

        # Revenue-eligible statuses
        revenue_statuses = [
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
            BookingStatus.CHECKED_OUT,
        ]

        today = date.today()
        month_start = today.replace(day=1)

        per_hostel = []
        for h in hostels:
            rooms = Room.objects.filter(variant__hostel=h)
            total_rooms = rooms.count()
            occupied_rooms = rooms.filter(
                status__in=["FULL", "PARTIALLY_BOOKED"]
            ).count()

            h_bookings = Booking.objects.filter(room__variant__hostel=h)
            total_bookings = h_bookings.count()
            confirmed_bookings = h_bookings.filter(
                status__in=revenue_statuses
            ).count()
            pending_checkins = h_bookings.filter(
                status=BookingStatus.CONFIRMED
            ).count()

            rev_qs = h_bookings.filter(status__in=revenue_statuses)
            total_revenue = rev_qs.aggregate(s=Sum("price_paid"))["s"] or 0
            this_month_revenue = (
                rev_qs.filter(created_at__date__gte=month_start)
                .aggregate(s=Sum("price_paid"))["s"]
                or 0
            )

            # Per-variant breakdown
            variant_stats = []
            for v in h.variants.all():
                v_bookings = Booking.objects.filter(
                    room__variant=v, status__in=revenue_statuses
                )
                v_revenue = v_bookings.aggregate(s=Sum("price_paid"))["s"] or 0
                variant_stats.append({
                    "id": str(v.id),
                    "name": v.name,
                    "bookings_count": v_bookings.count(),
                    "revenue": float(v_revenue),
                })

            per_hostel.append({
                "id": str(h.id),
                "name": h.name,
                "total_rooms": total_rooms,
                "occupied_rooms": occupied_rooms,
                "total_bookings": total_bookings,
                "confirmed_bookings": confirmed_bookings,
                "pending_checkins": pending_checkins,
                "total_revenue": float(total_revenue),
                "this_month_revenue": float(this_month_revenue),
                "variants": variant_stats,
            })

        # Aggregate totals
        totals = {
            "total_rooms": sum(h["total_rooms"] for h in per_hostel),
            "occupied_rooms": sum(h["occupied_rooms"] for h in per_hostel),
            "total_bookings": sum(h["total_bookings"] for h in per_hostel),
            "confirmed_bookings": sum(h["confirmed_bookings"] for h in per_hostel),
            "pending_checkins": sum(h["pending_checkins"] for h in per_hostel),
            "total_revenue": sum(h["total_revenue"] for h in per_hostel),
            "this_month_revenue": sum(h["this_month_revenue"] for h in per_hostel),
        }

        return Response({
            "totals": totals,
            "hostels": per_hostel,
        })
