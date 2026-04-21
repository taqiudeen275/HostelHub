"""Console SMS adapter — prints SMS to stdout instead of sending a real message.

Used in development and tests. Switch to ArkeselAdapter by setting:
    SMS_BACKEND=arkesel
in your .env file.
"""
import logging

from .base import SMSAdapter

logger = logging.getLogger(__name__)


class ConsoleAdapter(SMSAdapter):
    """Prints SMS to stdout/logs. Zero external dependencies."""

    def send(self, phone: str, message: str) -> dict:
        output = (
            "\n"
            "=" * 60 + "\n"
            f"📱 SMS TO: {phone}\n"
            f"📝 MESSAGE:\n{message}\n"
            "=" * 60
        )
        logger.info(output)
        print(output)   # also print so it shows in runserver output
        return {"success": True, "message_id": "console-dummy", "error": None}
