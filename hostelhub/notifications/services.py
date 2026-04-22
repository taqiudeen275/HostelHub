"""Notifications service layer — the single entry point for sending SMS."""
from __future__ import annotations

import logging
from decimal import Decimal

from django.conf import settings
from django.db.models import Q

from .adapters.base import SMSAdapter
from .models import SMSMessage


logger = logging.getLogger(__name__)

# Module-level import of django_q so tests can monkeypatch it to None.
try:
    from django_q.tasks import async_task  # type: ignore
except Exception:  # pragma: no cover
    async_task = None  # type: ignore


# ─── Adapter plumbing ────────────────────────────────────────────────────────


def get_adapter() -> SMSAdapter:
    """Return the SMS adapter configured by SMS_BACKEND env var."""
    backend = getattr(settings, "SMS_BACKEND", "console")
    if backend == "arkesel":
        from .adapters.arkesel import ArkeselAdapter
        return ArkeselAdapter()
    else:
        from .adapters.console import ConsoleAdapter
        return ConsoleAdapter()


# ─── Core send + log ──────────────────────────────────────────────────────────


def compute_segments(body: str) -> int:
    """
    GSM-7 segment math: a single SMS is 160 chars; multipart messages lose
    7 bytes per part to the UDH so each segment carries 153 chars.

    We cap at 3 segments (459 chars) per PRD §8.5.
    """
    n = len(body or "")
    if n == 0:
        return 0
    if n <= 160:
        return 1
    if n <= 306:
        return 2
    return 3


def send_and_log(
    *,
    phone: str,
    message: str,
    template_key: str | None = None,
    from_role: str = "SYSTEM",
    sent_by=None,
) -> tuple[dict, SMSMessage]:
    """
    Send an SMS and persist an `SMSMessage` audit row.

    Returns (result_dict, sms_message_row). Adapter failures still persist
    a row with status="FAILED".
    """
    adapter = get_adapter()
    result = adapter.send(phone, message) or {}

    cost_value = result.get("cost")
    cost_decimal = None
    if cost_value is not None:
        try:
            cost_decimal = Decimal(str(cost_value))
        except Exception:
            cost_decimal = None

    sms_row = SMSMessage.objects.create(
        to_phone=phone,
        from_role=from_role,
        sent_by=sent_by,
        body=message,
        template_key=template_key or "",
        arkesel_message_id=result.get("message_id") or "",
        status="SENT" if result.get("success") else "FAILED",
        cost=cost_decimal,
    )

    if not result.get("success"):
        logger.error(
            "Failed to send SMS to %s (template=%s): %s",
            phone, template_key, result.get("error"),
        )
    return result, sms_row


def send_sms(phone: str, message: str) -> dict:
    """Backwards-compatible thin wrapper — logs an SMSMessage too."""
    result, _ = send_and_log(phone=phone, message=message)
    return result


# ─── Transactional template helpers ───────────────────────────────────────────


def send_otp_sms(phone: str, code: str) -> dict:
    """Send the OTP verification SMS. Not logged as SMSMessage — OTPs are sensitive."""
    message = (
        f"Your HostelHub verification code is {code}. "
        "Valid for 5 minutes. Do not share this code."
    )
    adapter = get_adapter()
    return adapter.send(phone, message)


def send_booking_confirmation_sms(phone: str, hostel_name: str, room_label: str) -> dict:
    """Notify student of a confirmed booking."""
    message = (
        f"HostelHub: Your booking at {hostel_name}, Room {room_label} is CONFIRMED. "
        "Visit the app to view details and your roommates."
    )
    result, _ = send_and_log(
        phone=phone, message=message, template_key="booking_confirmed"
    )
    return result


def send_payment_received_sms(phone: str, amount_ghs, reference: str) -> dict:
    """Confirm successful payment capture."""
    amount_str = f"GH₵ {Decimal(amount_ghs).quantize(Decimal('0.01'))}"
    message = (
        f"HostelHub: Payment of {amount_str} received. "
        f"Reference {reference}. You can view your booking in the app."
    )
    result, _ = send_and_log(
        phone=phone, message=message, template_key="payment_received"
    )
    return result


def send_hostel_approval_sms(phone: str, hostel_name: str, approved: bool, reason: str = "") -> dict:
    """Notify hostel admin of approval/rejection."""
    if approved:
        message = (
            f"HostelHub: Your hostel '{hostel_name}' has been APPROVED "
            "and is now publicly listed."
        )
        template = "hostel_approved"
    else:
        message = (
            f"HostelHub: Your hostel '{hostel_name}' was not approved. "
            f"Reason: {reason}"
        )
        template = "hostel_rejected"
    result, _ = send_and_log(
        phone=phone, message=message, template_key=template
    )
    return result


def send_check_in_reminder_sms(
    phone: str, hostel_name: str, room_label: str, check_in_date
) -> dict:
    """Remind the student about a check-in due tomorrow."""
    date_str = check_in_date.strftime("%A %d %b") if check_in_date else "tomorrow"
    message = (
        f"HostelHub reminder: your check-in at {hostel_name}, "
        f"Room {room_label} is {date_str}. Safe travels!"
    )
    result, _ = send_and_log(
        phone=phone, message=message, template_key="check_in_reminder"
    )
    return result


def send_custom_broadcast_sms(
    *,
    phone: str,
    body: str,
    hostel_name: str,
    sent_by_user_id,
) -> dict:
    """
    Send a hostel-admin authored broadcast. Called via Django-Q for each recipient.

    The `sent_by_user_id` is resolved to a User lazily so this function can be
    safely pickled by Django-Q (passing the full User object sometimes triggers
    pickling surprises).
    """
    from accounts.models import User

    sent_by = None
    if sent_by_user_id:
        try:
            sent_by = User.objects.get(pk=sent_by_user_id)
        except User.DoesNotExist:
            pass

    prefix = f"[{hostel_name}] " if hostel_name else ""
    message = f"{prefix}{body}"
    result, _ = send_and_log(
        phone=phone,
        message=message,
        template_key="custom_broadcast",
        from_role="HOSTEL_ADMIN",
        sent_by=sent_by,
    )
    return result


# ─── Broadcast service (Phase D) ──────────────────────────────────────────────


def get_hostel_broadcast_audience(hostel) -> list[str]:
    """
    Return deduplicated phone numbers of students with active (CONFIRMED /
    CHECKED_IN) bookings in any room under this hostel.
    """
    from bookings.models import Booking, BookingStatus

    phones = (
        Booking.objects.filter(
            room__variant__hostel=hostel,
            status__in=(BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN),
        )
        .values_list("student__phone", flat=True)
        .distinct()
    )
    return [p for p in phones if p]


def compute_broadcast_cost(segments: int, audience_count: int) -> Decimal:
    """Local estimate — Arkesel-truthful cost is persisted per-row after send."""
    rate = Decimal(str(
        getattr(settings, "SMS_BROADCAST_COST_PER_SEGMENT_GHS", "0.10")
    ))
    return (rate * segments * audience_count).quantize(Decimal("0.01"))


def broadcast_to_hostel_bookers(hostel, body: str, sent_by) -> dict:
    """
    Enqueue one SMS per active booker of this hostel. Returns a summary so
    the view can render it immediately.
    """
    audience = get_hostel_broadcast_audience(hostel)
    segments = compute_segments(body)
    cost = compute_broadcast_cost(segments, len(audience))

    q_available = async_task is not None

    for phone in audience:
        kwargs = dict(
            phone=phone,
            body=body,
            hostel_name=hostel.name,
            sent_by_user_id=sent_by.id if sent_by else None,
        )
        if q_available and async_task is not None:
            async_task("notifications.services.send_custom_broadcast_sms", **kwargs)
        else:
            # Fallback: synchronous send (dev without qcluster running)
            send_custom_broadcast_sms(**kwargs)

    logger.info(
        "Broadcast queued for hostel=%s by=%s recipients=%d segments=%d cost≈%s",
        hostel.name, getattr(sent_by, "phone", None), len(audience), segments, cost,
    )
    return {
        "audience_count": len(audience),
        "segments": segments,
        "estimated_cost_ghs": str(cost),
        "async": q_available,
    }


def get_broadcast_log(hostel, *, sent_by=None):
    """Return the QuerySet of SMSMessage rows scoped to this hostel's broadcasts."""
    audience_phones = get_hostel_broadcast_audience(hostel)
    filters = Q(template_key="custom_broadcast")
    if sent_by is not None:
        filters &= Q(sent_by=sent_by)
    # Scope to phones currently (or recently) in the hostel audience — keeps the
    # view owner-scoped even if sent_by moves to null later.
    filters &= Q(to_phone__in=audience_phones) if audience_phones else Q(sent_by=sent_by)
    return SMSMessage.objects.filter(filters).order_by("-created_at")
