"""Payment domain services. Mediates between Booking, Paystack, and notifications."""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from datetime import datetime
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from bookings.models import Booking, BookingStatus
from bookings.services import cancel_booking, confirm_booking

from .adapters.paystack import PaystackError, get_paystack_adapter
from .models import Payment, PaymentChannel, PaymentStatus


logger = logging.getLogger(__name__)


def _gen_reference(booking_id) -> str:
    """Build a unique, human-friendly Paystack reference."""
    return f"HH-{str(booking_id)[:8]}-{secrets.token_hex(4).upper()}"


def _callback_url() -> str:
    base = getattr(settings, "PAYMENT_CALLBACK_URL", "http://localhost:3000/student/bookings/callback")
    return base


# ─── Public API ──────────────────────────────────────────────────────────────


def initialize_payment(booking: Booking) -> tuple[Payment, str]:
    """
    Create a Payment row (INITIATED) and ask Paystack for an authorization URL.
    Returns (payment, authorization_url).
    """
    reference = _gen_reference(booking.id)
    email = booking.student.email or f"student+{booking.student.id}@hostelhub.local"

    payment = Payment.objects.create(
        booking=booking,
        paystack_reference=reference,
        amount=booking.price_paid,
        currency="GHS",
        status=PaymentStatus.INITIATED,
    )

    adapter = get_paystack_adapter()
    try:
        data = adapter.initialize(
            amount_ghs=booking.price_paid,
            email=email,
            reference=reference,
            callback_url=_callback_url(),
            metadata={
                "booking_id": str(booking.id),
                "hostel": booking.room.variant.hostel.name,
                "room": booking.room.label,
            },
        )
    except PaystackError as exc:
        logger.error("Paystack initialize failed for booking %s: %s", booking.id, exc)
        payment.status = PaymentStatus.FAILED
        payment.paystack_raw = {"error": str(exc)}
        payment.save(update_fields=["status", "paystack_raw"])
        raise

    payment.paystack_raw = data
    payment.save(update_fields=["paystack_raw"])
    return payment, data["authorization_url"]


def verify_webhook_signature(*, body: bytes, signature: str | None) -> bool:
    """HMAC-SHA512 over the raw request body using the Paystack secret key."""
    if not signature:
        return False
    secret = getattr(settings, "PAYSTACK_SECRET_KEY", "")
    if not secret:
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(expected, signature)


@transaction.atomic
def apply_paystack_event(event: dict) -> Payment | None:
    """
    Idempotently apply a Paystack webhook payload. Returns the Payment we touched,
    or None if the event is irrelevant (unknown reference, unknown event type).
    """
    event_type = event.get("event")
    data = event.get("data", {}) or {}
    reference = data.get("reference")
    if not reference:
        return None
    try:
        payment = Payment.objects.select_for_update().get(paystack_reference=reference)
    except Payment.DoesNotExist:
        logger.warning("Webhook for unknown reference %s", reference)
        return None

    if event_type == "charge.success":
        return _apply_success(payment, data)
    if event_type in ("charge.failed", "charge.declined"):
        return _apply_failure(payment, data)
    if event_type == "refund.processed":
        return _apply_refund(payment, data)
    return payment


def verify_payment_now(payment: Payment) -> Payment:
    """
    Directly hit Paystack's verify endpoint and apply the result. Used when the
    frontend polls `/payments/{id}/` and the webhook hasn't arrived yet (common
    in localhost dev without a public URL).
    """
    if payment.status != PaymentStatus.INITIATED:
        return payment
    adapter = get_paystack_adapter()
    try:
        data = adapter.verify(payment.paystack_reference)
    except PaystackError as exc:
        logger.warning("Paystack verify failed for %s: %s", payment.paystack_reference, exc)
        return payment
    status = (data.get("status") or "").lower()
    event = {"event": "charge.success" if status == "success" else "charge.failed", "data": data}
    return apply_paystack_event(event) or payment


def initiate_refund(payment: Payment, *, reason: str, amount: Decimal | None = None) -> Payment:
    """Trigger a Paystack refund and record the state locally."""
    if payment.status != PaymentStatus.SUCCESS:
        raise ValueError(f"Cannot refund payment in status {payment.status}.")
    adapter = get_paystack_adapter()
    data = adapter.refund(payment.paystack_reference, amount_ghs=amount)
    with transaction.atomic():
        payment.status = PaymentStatus.REFUNDED
        payment.refund_reason = reason or ""
        payment.refunded_at = timezone.now()
        payment.paystack_raw = {**(payment.paystack_raw or {}), "refund": data}
        payment.save(
            update_fields=["status", "refund_reason", "refunded_at", "paystack_raw"]
        )
        booking = payment.booking
        # A refund effectively cancels the booking — release the slot.
        if booking.status in (BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN):
            cancel_booking(booking)
            # Mark as REFUNDED (cancel_booking set it to CANCELLED).
            booking.status = BookingStatus.REFUNDED
            booking.save(update_fields=["status", "updated_at"])
    return payment


# ─── Internals ────────────────────────────────────────────────────────────────


def _apply_success(payment: Payment, data: dict) -> Payment:
    if payment.status == PaymentStatus.SUCCESS:
        return payment  # Idempotent

    payment.status = PaymentStatus.SUCCESS
    payment.verified_at = timezone.now()
    payment.channel = data.get("channel") or PaymentChannel.UNKNOWN
    payment.paystack_raw = data
    if data.get("amount"):
        payment.amount = (Decimal(data["amount"]) / 100).quantize(Decimal("0.01"))
    payment.save(update_fields=["status", "verified_at", "channel", "paystack_raw", "amount"])

    try:
        confirm_booking(payment.booking)
    except Exception as exc:  # pragma: no cover
        logger.exception("confirm_booking failed for %s: %s", payment.booking_id, exc)
        raise

    # Fire-and-forget SMS (caller is inside an atomic; send lives outside in views)
    payment.refresh_from_db()
    return payment


def _apply_failure(payment: Payment, data: dict) -> Payment:
    if payment.status in (PaymentStatus.FAILED, PaymentStatus.SUCCESS):
        return payment  # Don't overwrite a success with a stale failure

    payment.status = PaymentStatus.FAILED
    payment.paystack_raw = data
    payment.save(update_fields=["status", "paystack_raw"])

    booking = payment.booking
    if booking.status == BookingStatus.PENDING_PAYMENT:
        try:
            cancel_booking(booking)
        except Exception:  # pragma: no cover
            logger.exception("cancel_booking on failure failed for %s", booking.id)
    return payment


def _apply_refund(payment: Payment, data: dict) -> Payment:
    if payment.status == PaymentStatus.REFUNDED:
        return payment
    payment.status = PaymentStatus.REFUNDED
    payment.refunded_at = timezone.now()
    payment.paystack_raw = {**(payment.paystack_raw or {}), "refund": data}
    payment.save(update_fields=["status", "refunded_at", "paystack_raw"])
    return payment
