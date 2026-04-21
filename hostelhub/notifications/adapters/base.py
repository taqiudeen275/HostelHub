"""Base adapter interface for SMS providers."""
from abc import ABC, abstractmethod


class SMSAdapter(ABC):
    """Abstract SMS adapter. All SMS providers must implement this interface."""

    @abstractmethod
    def send(self, phone: str, message: str) -> dict:
        """
        Send an SMS to a single recipient.

        Args:
            phone: E.164 formatted phone number e.g. +233244123456
            message: The SMS body text

        Returns:
            dict with keys: success (bool), message_id (str|None), error (str|None),
                            raw (dict|None)
        """
        raise NotImplementedError

    def send_bulk(self, phones: list[str], message: str) -> dict:
        """
        Send the same SMS to multiple recipients.
        Default implementation falls back to individual sends.
        Providers that support native batch endpoints should override this.
        """
        result = {"success": True, "message_id": None, "error": None, "raw": None}
        failures = []
        for phone in phones:
            r = self.send(phone, message)
            if not r["success"]:
                failures.append(f"{phone}: {r['error']}")
        if failures:
            result["success"] = False
            result["error"] = "; ".join(failures)
        return result

    def get_balance(self) -> dict:
        """
        Fetch remaining SMS credit balance (provider-specific).
        Returns dict with: success, balance (float|None), currency, error.
        Default returns not-implemented — override in production adapters.
        """
        return {
            "success": False,
            "balance": None,
            "currency": None,
            "error": "Balance check not supported by this adapter",
        }

