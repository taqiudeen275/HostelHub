"""Arkesel SMS adapter — production SMS via Arkesel API v2.

Reference: https://developers.arkesel.com/
Activate by setting SMS_BACKEND=arkesel in .env.
"""
import logging

import requests
from django.conf import settings

from .base import SMSAdapter

logger = logging.getLogger(__name__)

ARKESEL_SEND_URL = "https://sms.arkesel.com/api/v2/sms/send"


class ArkeselAdapter(SMSAdapter):
    """Sends real SMS via Arkesel API v2."""

    def __init__(self):
        self.api_key = settings.ARKESEL_API_KEY
        self.sender_id = settings.ARKESEL_SENDER_ID

    def send(self, phone: str, message: str) -> dict:
        if not self.api_key:
            logger.error("ARKESEL_API_KEY is not set. Cannot send SMS.")
            return {"success": False, "message_id": None, "error": "API key missing"}

        payload = {
            "sender": self.sender_id,
            "message": message,
            "recipients": [phone],
        }
        headers = {"api-key": self.api_key}

        try:
            response = requests.post(
                ARKESEL_SEND_URL,
                json=payload,
                headers=headers,
                timeout=10,
            )
            data = response.json()

            if response.status_code == 200 and data.get("status") == "success":
                message_id = (
                    data.get("data", [{}])[0].get("id") if data.get("data") else None
                )
                logger.info("SMS sent to %s via Arkesel. ID: %s", phone, message_id)
                return {"success": True, "message_id": message_id, "error": None}
            else:
                error_msg = data.get("message", "Unknown Arkesel error")
                logger.error("Arkesel send failed for %s: %s", phone, error_msg)
                return {"success": False, "message_id": None, "error": error_msg}

        except requests.RequestException as e:
            logger.exception("Network error sending SMS to %s: %s", phone, e)
            return {"success": False, "message_id": None, "error": str(e)}
