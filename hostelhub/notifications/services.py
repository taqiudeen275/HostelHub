"""Notifications service layer — the single entry point for sending SMS."""
import logging

from django.conf import settings

from .adapters.base import SMSAdapter

logger = logging.getLogger(__name__)


def get_adapter() -> SMSAdapter:
    """Return the SMS adapter configured by SMS_BACKEND env var."""
    backend = getattr(settings, "SMS_BACKEND", "console")
    if backend == "arkesel":
        from .adapters.arkesel import ArkeselAdapter
        return ArkeselAdapter()
    else:
        from .adapters.console import ConsoleAdapter
        return ConsoleAdapter()


def send_sms(phone: str, message: str) -> dict:
    """Send an SMS message via the configured adapter."""
    adapter = get_adapter()
    result = adapter.send(phone, message)
    if not result["success"]:
        logger.error("Failed to send SMS to %s: %s", phone, result.get("error"))
    return result


def send_otp_sms(phone: str, code: str) -> dict:
    """Send the OTP verification SMS."""
    message = f"Your HostelHub verification code is {code}. Valid for 5 minutes. Do not share this code."
    return send_sms(phone, message)


def send_booking_confirmation_sms(phone: str, hostel_name: str, room_label: str) -> dict:
    """Notify student of a confirmed booking."""
    message = (
        f"HostelHub: Your booking at {hostel_name}, Room {room_label} is CONFIRMED. "
        "Visit the app to view details and your roommates."
    )
    return send_sms(phone, message)


def send_hostel_approval_sms(phone: str, hostel_name: str, approved: bool, reason: str = "") -> dict:
    """Notify hostel admin of approval/rejection."""
    if approved:
        message = f"HostelHub: Your hostel '{hostel_name}' has been APPROVED and is now publicly listed."
    else:
        message = f"HostelHub: Your hostel '{hostel_name}' was not approved. Reason: {reason}"
    return send_sms(phone, message)
