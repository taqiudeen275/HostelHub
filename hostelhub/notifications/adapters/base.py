"""Base adapter interface for SMS providers."""
from abc import ABC, abstractmethod


class SMSAdapter(ABC):
    """Abstract SMS adapter. All SMS providers must implement this interface."""

    @abstractmethod
    def send(self, phone: str, message: str) -> dict:
        """
        Send an SMS message.

        Args:
            phone: E.164 formatted phone number e.g. +233244123456
            message: The SMS body text

        Returns:
            dict with keys: success (bool), message_id (str|None), error (str|None)
        """
        raise NotImplementedError
