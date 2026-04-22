"""Payment HTTP endpoints (including the Paystack webhook)."""
import json
import logging

from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from accounts.permissions import IsSuperAdmin
from notifications.services import send_booking_confirmation_sms

from . import services
from .adapters.paystack import PaystackError
from .models import Payment, PaymentStatus
from .serializers import PaymentSerializer, RefundRequestSerializer


logger = logging.getLogger(__name__)


def _payment_visible_to(payment: Payment, user) -> bool:
    if user.role == UserRole.SUPER_ADMIN:
        return True
    booking = payment.booking
    if user.role == UserRole.STUDENT and booking.student_id == user.id:
        return True
    if (
        user.role == UserRole.HOSTEL_ADMIN
        and booking.room.variant.hostel.owner_id == user.id
    ):
        return True
    return False


class PaymentDetailView(APIView):
    """
    GET /api/v1/payments/{id}/
    If the payment is still INITIATED, we proactively hit Paystack's verify
    endpoint so localhost dev doesn't depend on a publicly-reachable webhook.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        payment = get_object_or_404(
            Payment.objects.select_related("booking__student", "booking__room__variant__hostel"),
            pk=pk,
        )
        if not _payment_visible_to(payment, request.user):
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        if payment.status == PaymentStatus.INITIATED:
            try:
                payment = services.verify_payment_now(payment)
            except PaystackError as exc:
                logger.warning("Live verify failed for %s: %s", payment.id, exc)

            payment.refresh_from_db()
            if payment.status == PaymentStatus.SUCCESS:
                _fire_confirmation_sms(payment)

        return Response(PaymentSerializer(payment).data)


@method_decorator(csrf_exempt, name="dispatch")
class PaystackWebhookView(APIView):
    """POST /api/v1/payments/paystack/webhook/ — HMAC-SHA512 verified, idempotent."""
    permission_classes = [AllowAny]
    authentication_classes: list = []  # Paystack doesn't speak JWT

    def post(self, request):
        body = request.body  # raw bytes — must read before DRF parses
        signature = request.headers.get("x-paystack-signature")
        if not services.verify_webhook_signature(body=body, signature=signature):
            logger.warning("Rejected webhook with bad signature")
            return Response(
                {"error": "Invalid signature."}, status=status.HTTP_401_UNAUTHORIZED
            )

        try:
            event = json.loads(body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return Response(
                {"error": "Invalid JSON body."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            payment = services.apply_paystack_event(event)
        except Exception:  # pragma: no cover
            logger.exception("Webhook processing failed")
            return Response(status=status.HTTP_200_OK)  # swallow; don't let Paystack retry

        if payment is not None and payment.status == PaymentStatus.SUCCESS:
            _fire_confirmation_sms(payment)

        return Response({"received": True}, status=status.HTTP_200_OK)


class PaymentRefundView(APIView):
    """POST /api/v1/payments/{id}/refund/ — super admin only."""
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        payment = get_object_or_404(Payment, pk=pk)
        serializer = RefundRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment = services.initiate_refund(
                payment,
                reason=serializer.validated_data["reason"],
                amount=serializer.validated_data.get("amount"),
            )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
        except PaystackError as exc:
            logger.error("Refund failed for %s: %s", payment.id, exc)
            return Response(
                {"error": "Paystack refund failed. Check logs."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(PaymentSerializer(payment).data)


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _fire_confirmation_sms(payment: Payment) -> None:
    """Send the booking-confirmed SMS. Called outside atomic blocks only."""
    try:
        booking = payment.booking
        send_booking_confirmation_sms(
            phone=booking.student.phone,
            hostel_name=booking.room.variant.hostel.name,
            room_label=booking.room.label,
        )
    except Exception:  # pragma: no cover
        logger.exception("SMS send failed for payment %s", payment.id)
