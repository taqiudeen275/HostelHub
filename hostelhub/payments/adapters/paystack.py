"""Paystack HTTP adapter. Wraps `/transaction/initialize`, `/verify`, `/refund`."""
from __future__ import annotations

import logging
import time
from decimal import Decimal
from typing import Any

import requests
from django.conf import settings


logger = logging.getLogger(__name__)

PAYSTACK_BASE_URL = "https://api.paystack.co"
PAYSTACK_TIMEOUT_SECONDS = 15
PAYSTACK_MAX_RETRIES = 3


class PaystackError(Exception):
    """Raised for any non-2xx response from Paystack after retries exhausted."""


class PaystackAdapter:
    """Thin wrapper around Paystack's REST endpoints."""

    def __init__(self, secret_key: str | None = None):
        self.secret_key = secret_key or getattr(settings, "PAYSTACK_SECRET_KEY", "")
        if not self.secret_key:
            logger.warning("PAYSTACK_SECRET_KEY is not configured.")

    # ─── Public methods ───────────────────────────────────────────────────────

    def initialize(
        self,
        *,
        amount_ghs: Decimal,
        email: str,
        reference: str,
        callback_url: str,
        metadata: dict | None = None,
    ) -> dict:
        """
        POST /transaction/initialize. Amounts are in pesewas (GHS × 100).
        Returns Paystack's `data` block with `authorization_url` + `reference`.
        """
        amount_pesewas = int(Decimal(amount_ghs) * 100)
        payload = {
            "email": email,
            "amount": amount_pesewas,
            "currency": "GHS",
            "reference": reference,
            "callback_url": callback_url,
            "channels": ["card", "mobile_money", "bank"],
        }
        if metadata:
            payload["metadata"] = metadata
        data = self._post("/transaction/initialize", payload)
        return data

    def verify(self, reference: str) -> dict:
        """GET /transaction/verify/{reference}."""
        return self._get(f"/transaction/verify/{reference}")

    def refund(self, reference: str, amount_ghs: Decimal | None = None) -> dict:
        """POST /refund. Amount optional — omit for full refund."""
        payload: dict[str, Any] = {"transaction": reference}
        if amount_ghs is not None:
            payload["amount"] = int(Decimal(amount_ghs) * 100)
        return self._post("/refund", payload)

    # ─── HTTP plumbing ────────────────────────────────────────────────────────

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }

    def _post(self, path: str, payload: dict) -> dict:
        return self._request("POST", path, json=payload)

    def _get(self, path: str) -> dict:
        return self._request("GET", path)

    def _request(self, method: str, path: str, **kwargs) -> dict:
        url = f"{PAYSTACK_BASE_URL}{path}"
        last_exc: Exception | None = None
        for attempt in range(1, PAYSTACK_MAX_RETRIES + 1):
            try:
                resp = requests.request(
                    method,
                    url,
                    headers=self._headers(),
                    timeout=PAYSTACK_TIMEOUT_SECONDS,
                    **kwargs,
                )
                if 500 <= resp.status_code < 600:
                    raise PaystackError(f"5xx from Paystack: {resp.status_code}")
                body = resp.json() if resp.content else {}
                if not resp.ok or not body.get("status"):
                    raise PaystackError(
                        f"Paystack rejected {method} {path}: "
                        f"status={resp.status_code} body={body}"
                    )
                return body.get("data", body)
            except (requests.RequestException, PaystackError) as exc:
                last_exc = exc
                if attempt == PAYSTACK_MAX_RETRIES:
                    break
                backoff = 2 ** (attempt - 1)
                logger.warning(
                    "Paystack %s %s failed (attempt %d/%d): %s. Retrying in %ds.",
                    method, path, attempt, PAYSTACK_MAX_RETRIES, exc, backoff,
                )
                time.sleep(backoff)
        raise PaystackError(
            f"Paystack {method} {path} failed after {PAYSTACK_MAX_RETRIES} attempts: {last_exc}"
        )


_default_adapter: PaystackAdapter | None = None


def get_paystack_adapter() -> PaystackAdapter:
    """Factory — tests can monkeypatch this module-level function to inject a fake."""
    global _default_adapter
    if _default_adapter is None:
        _default_adapter = PaystackAdapter()
    return _default_adapter
