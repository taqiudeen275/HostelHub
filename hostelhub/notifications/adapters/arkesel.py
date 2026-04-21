"""
Arkesel SMS adapter — production SMS via Arkesel API v2.

Arkesel API v2 reference: https://developers.arkesel.com/
Spec version confirmed: api_spec.v2.3.1

== Quick-start ==
Set in .env:
    SMS_BACKEND=arkesel
    ARKESEL_API_KEY=<your key from account.arkesel.com>
    ARKESEL_SENDER_ID=HostelHub          # must be approved by Arkesel
    ARKESEL_USE_SANDBOX=False            # set True in staging to skip real delivery

== Response contract ==
All methods return:
    {
        "success": bool,
        "message_id": str | None,   # Arkesel sms_id (16-char UUID)
        "error": str | None,
        "raw": dict | None,         # full Arkesel response for logging
    }

== Retry policy ==
Transient errors (5xx, network) are retried up to ARKESEL_MAX_RETRIES times
with exponential back-off: 1s → 2s → 4s (jittered ±20%).
Client errors (4xx) are not retried.
"""
import logging
import random
import time

import requests
from django.conf import settings

from .base import SMSAdapter

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Arkesel v2 endpoint constants
# ---------------------------------------------------------------------------
ARKESEL_BASE_URL = "https://sms.arkesel.com/api/v2"
ARKESEL_SEND_URL = f"{ARKESEL_BASE_URL}/sms/send"
ARKESEL_BALANCE_URL = f"{ARKESEL_BASE_URL}/clients/balance/sms"

# HTTP status codes that are safe to retry (transient server errors)
_RETRYABLE_STATUS_CODES = {500, 502, 503, 504}

# Arkesel application-level error codes that signal a transient problem
# (vs. a permanent config error like wrong sender ID)
_RETRYABLE_APP_CODES = {"2000"}   # internal server error


class ArkeselAdapter(SMSAdapter):
    """
    Sends SMS via the Arkesel API v2.

    Configuration (all via Django settings / .env):
        ARKESEL_API_KEY        — required; from your Arkesel dashboard
        ARKESEL_SENDER_ID      — required; must be approved by Arkesel (24-48h)
        ARKESEL_USE_SANDBOX    — optional bool (default False); set True in staging
        ARKESEL_CALLBACK_URL   — optional; Arkesel will POST delivery updates here
        ARKESEL_MAX_RETRIES    — optional int (default 3)
        ARKESEL_TIMEOUT        — optional int seconds (default 10)
    """

    def __init__(self):
        self.api_key = getattr(settings, "ARKESEL_API_KEY", "")
        self.sender_id = getattr(settings, "ARKESEL_SENDER_ID", "HostelHub")
        self.use_sandbox = getattr(settings, "ARKESEL_USE_SANDBOX", False)
        self.callback_url = getattr(settings, "ARKESEL_CALLBACK_URL", "")
        self.max_retries = getattr(settings, "ARKESEL_MAX_RETRIES", 3)
        self.timeout = getattr(settings, "ARKESEL_TIMEOUT", 10)

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def send(self, phone: str, message: str) -> dict:
        """
        Send a single SMS to one recipient.

        Args:
            phone:   E.164 number e.g. +233244123456
            message: Plain-text SMS body (max 459 chars = 3 segments)

        Returns:
            Standard result dict (see module docstring).
        """
        return self._send_request([phone], message)

    def send_bulk(self, phones: list[str], message: str) -> dict:
        """
        Send the same SMS to multiple recipients in a single API call.
        Arkesel v2 accepts a list in the `recipients` field.

        Returns aggregate result:
            success = True only if the API accepted the batch.
            message_id = None for bulk (Arkesel returns one ID per recipient
                          in data[]; we log them but don't surface all here).
        """
        return self._send_request(phones, message)

    def get_balance(self) -> dict:
        """
        Fetch the remaining SMS credit balance from Arkesel.

        Returns:
            {
                "success": bool,
                "balance": float | None,
                "currency": str | None,
                "error": str | None,
            }
        """
        if not self.api_key:
            return {"success": False, "balance": None, "currency": None,
                    "error": "ARKESEL_API_KEY not set"}

        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }
        try:
            resp = requests.get(ARKESEL_BALANCE_URL, headers=headers, timeout=self.timeout)
            data = resp.json()

            if resp.status_code == 200:
                balance_val = data.get("balance") or data.get("sms_balance")
                logger.info("Arkesel balance: %s", balance_val)
                return {
                    "success": True,
                    "balance": balance_val,
                    "currency": data.get("currency", "GHS"),
                    "error": None,
                }
            else:
                msg = data.get("message", f"HTTP {resp.status_code}")
                logger.warning("Arkesel balance check failed: %s", msg)
                return {"success": False, "balance": None, "currency": None, "error": msg}

        except requests.RequestException as exc:
            logger.exception("Network error fetching Arkesel balance: %s", exc)
            return {"success": False, "balance": None, "currency": None, "error": str(exc)}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_payload(self, recipients: list[str], message: str) -> dict:
        """Build the Arkesel v2 request payload."""
        payload: dict = {
            "sender": self.sender_id,
            "message": message,
            "recipients": recipients,
        }
        if self.use_sandbox:
            payload["sandbox"] = True
        if self.callback_url:
            payload["callback_url"] = self.callback_url
        return payload

    def _send_request(self, recipients: list[str], message: str) -> dict:
        """Core send logic with exponential back-off retry."""
        if not self.api_key:
            logger.error("ARKESEL_API_KEY is not configured. Cannot send SMS.")
            return {"success": False, "message_id": None,
                    "error": "ARKESEL_API_KEY not set", "raw": None}

        if not recipients:
            return {"success": False, "message_id": None,
                    "error": "No recipients provided", "raw": None}

        if not message or not message.strip():
            return {"success": False, "message_id": None,
                    "error": "Empty message body", "raw": None}

        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = self._build_payload(recipients, message)

        attempt = 0
        last_error = "Unknown error"
        last_raw: dict | None = None

        while attempt < self.max_retries:
            attempt += 1
            try:
                response = requests.post(
                    ARKESEL_SEND_URL,
                    json=payload,
                    headers=headers,
                    timeout=self.timeout,
                )
                data: dict = {}
                try:
                    data = response.json()
                except ValueError:
                    data = {"raw_text": response.text}

                last_raw = data

                # ── Success ──────────────────────────────────────────
                if response.status_code == 200 and data.get("status") == "success":
                    # data["data"] is a list of per-recipient objects
                    records = data.get("data") or []
                    # For single sends, grab the first sms_id
                    sms_id = records[0].get("id") if records else None
                    logger.info(
                        "Arkesel: SMS sent to %d recipient(s). sms_id=%s sandbox=%s",
                        len(recipients), sms_id, self.use_sandbox,
                    )
                    return {
                        "success": True,
                        "message_id": sms_id,
                        "error": None,
                        "raw": data,
                    }

                # ── Client errors (4xx) — do NOT retry ───────────────
                code = str(data.get("code", ""))
                msg = data.get("message", f"HTTP {response.status_code}")

                if response.status_code == 401:
                    logger.error("Arkesel: Invalid API key (401). Check ARKESEL_API_KEY.")
                    return {"success": False, "message_id": None,
                            "error": "Invalid API key", "raw": data}

                if response.status_code == 402:
                    logger.error("Arkesel: Insufficient SMS balance (402).")
                    return {"success": False, "message_id": None,
                            "error": "Insufficient Arkesel balance", "raw": data}

                if response.status_code == 403:
                    logger.error(
                        "Arkesel: Forbidden (403) — sender ID '%s' may not be approved yet.",
                        self.sender_id,
                    )
                    return {"success": False, "message_id": None,
                            "error": f"Forbidden: {msg}", "raw": data}

                if response.status_code == 422:
                    logger.error("Arkesel: Unprocessable entity (422): %s", msg)
                    return {"success": False, "message_id": None,
                            "error": f"Invalid request: {msg}", "raw": data}

                if response.status_code == 400:
                    logger.error("Arkesel: Bad request (400): %s", msg)
                    return {"success": False, "message_id": None,
                            "error": f"Bad request: {msg}", "raw": data}

                # ── Server errors (5xx) — retry with back-off ────────
                if response.status_code in _RETRYABLE_STATUS_CODES or code in _RETRYABLE_APP_CODES:
                    last_error = f"HTTP {response.status_code}: {msg}"
                    if attempt < self.max_retries:
                        delay = self._backoff(attempt)
                        logger.warning(
                            "Arkesel: transient error (attempt %d/%d) — retrying in %.1fs. %s",
                            attempt, self.max_retries, delay, last_error,
                        )
                        time.sleep(delay)
                        continue

                # Any other non-success response (unexpected) — no retry
                last_error = msg
                logger.error("Arkesel: Unexpected response %s: %s", response.status_code, msg)
                return {"success": False, "message_id": None, "error": last_error, "raw": data}

            except requests.Timeout:
                last_error = f"Request timed out after {self.timeout}s"
                logger.warning("Arkesel: timeout (attempt %d/%d)", attempt, self.max_retries)
                if attempt < self.max_retries:
                    time.sleep(self._backoff(attempt))

            except requests.ConnectionError as exc:
                last_error = f"Connection error: {exc}"
                logger.warning(
                    "Arkesel: connection error (attempt %d/%d): %s",
                    attempt, self.max_retries, exc,
                )
                if attempt < self.max_retries:
                    time.sleep(self._backoff(attempt))

            except requests.RequestException as exc:
                last_error = str(exc)
                logger.exception("Arkesel: unexpected network error: %s", exc)
                # Don't retry truly unexpected errors
                return {"success": False, "message_id": None, "error": last_error, "raw": None}

        # All retries exhausted
        logger.error(
            "Arkesel: all %d retries exhausted for %d recipient(s). Last error: %s",
            self.max_retries, len(recipients), last_error,
        )
        return {"success": False, "message_id": None, "error": last_error, "raw": last_raw}

    @staticmethod
    def _backoff(attempt: int) -> float:
        """Exponential back-off with ±20% jitter: 1s, 2s, 4s, …"""
        base = 2 ** (attempt - 1)          # 1, 2, 4, 8, …
        jitter = base * random.uniform(-0.2, 0.2)
        return round(base + jitter, 2)

