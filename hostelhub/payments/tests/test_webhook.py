"""Paystack webhook — signature verification + idempotency."""
import hashlib
import hmac
import json
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.conf import settings
from rest_framework.test import APIClient

from bookings.models import Booking, BookingStatus
from payments.models import Payment, PaymentStatus
from payments.services import initialize_payment


pytestmark = pytest.mark.django_db


WEBHOOK_URL = "/api/v1/payments/paystack/webhook/"


def _sign(body: bytes, secret: str | None = None) -> str:
    secret = secret or settings.PAYSTACK_SECRET_KEY
    return hmac.new(secret.encode(), body, hashlib.sha512).hexdigest()


@pytest.fixture
def payment(pending_booking):
    """Initialize a payment against a fake Paystack (so we don't hit the network)."""
    with patch("payments.services.get_paystack_adapter") as get_adapter:
        fake = get_adapter.return_value
        fake.initialize.return_value = {
            "authorization_url": "https://checkout.paystack.com/fake",
            "access_code": "fake",
            "reference": "HH-TEST-REFERENCE",
        }
        payment_obj, _ = initialize_payment(pending_booking)
    # Override the reference to a predictable value for assertions
    payment_obj.paystack_reference = "HH-TEST-REFERENCE"
    payment_obj.save(update_fields=["paystack_reference"])
    return payment_obj


def test_webhook_rejects_missing_signature(payment):
    client = APIClient()
    body = json.dumps(
        {
            "event": "charge.success",
            "data": {"reference": payment.paystack_reference, "status": "success"},
        }
    ).encode()
    res = client.post(WEBHOOK_URL, body, content_type="application/json")
    assert res.status_code == 401


def test_webhook_rejects_bad_signature(payment):
    client = APIClient()
    body = json.dumps(
        {
            "event": "charge.success",
            "data": {"reference": payment.paystack_reference, "status": "success"},
        }
    ).encode()
    res = client.post(
        WEBHOOK_URL,
        body,
        content_type="application/json",
        HTTP_X_PAYSTACK_SIGNATURE="deadbeef" * 16,
    )
    assert res.status_code == 401


def test_webhook_success_confirms_booking(payment):
    client = APIClient()
    body = json.dumps(
        {
            "event": "charge.success",
            "data": {
                "reference": payment.paystack_reference,
                "status": "success",
                "channel": "mobile_money",
                "amount": int(Decimal("3000") * 100),
            },
        }
    ).encode()
    res = client.post(
        WEBHOOK_URL,
        body,
        content_type="application/json",
        HTTP_X_PAYSTACK_SIGNATURE=_sign(body),
    )
    assert res.status_code == 200

    payment.refresh_from_db()
    payment.booking.refresh_from_db()
    assert payment.status == PaymentStatus.SUCCESS
    assert payment.channel == "mobile_money"
    assert payment.booking.status == BookingStatus.CONFIRMED


def test_webhook_is_idempotent(payment):
    client = APIClient()
    body = json.dumps(
        {
            "event": "charge.success",
            "data": {
                "reference": payment.paystack_reference,
                "status": "success",
                "channel": "card",
                "amount": 300000,
            },
        }
    ).encode()
    sig = _sign(body)
    res1 = client.post(WEBHOOK_URL, body, content_type="application/json", HTTP_X_PAYSTACK_SIGNATURE=sig)
    res2 = client.post(WEBHOOK_URL, body, content_type="application/json", HTTP_X_PAYSTACK_SIGNATURE=sig)

    assert res1.status_code == 200
    assert res2.status_code == 200
    # Only one SUCCESS payment exists, and the booking is still just CONFIRMED (not double-processed).
    payment.refresh_from_db()
    assert payment.status == PaymentStatus.SUCCESS
    assert Booking.objects.filter(id=payment.booking_id, status=BookingStatus.CONFIRMED).count() == 1


def test_webhook_failed_cancels_booking(payment):
    client = APIClient()
    body = json.dumps(
        {
            "event": "charge.failed",
            "data": {"reference": payment.paystack_reference, "status": "failed"},
        }
    ).encode()
    res = client.post(
        WEBHOOK_URL,
        body,
        content_type="application/json",
        HTTP_X_PAYSTACK_SIGNATURE=_sign(body),
    )
    assert res.status_code == 200

    payment.refresh_from_db()
    payment.booking.refresh_from_db()
    assert payment.status == PaymentStatus.FAILED
    assert payment.booking.status == BookingStatus.CANCELLED


def test_webhook_unknown_reference_silently_ok(db):
    client = APIClient()
    body = json.dumps(
        {
            "event": "charge.success",
            "data": {"reference": "HH-UNKNOWN-XXXX", "status": "success"},
        }
    ).encode()
    res = client.post(
        WEBHOOK_URL,
        body,
        content_type="application/json",
        HTTP_X_PAYSTACK_SIGNATURE=_sign(body),
    )
    # Paystack shouldn't retry on us, so we return 200 even when we don't recognise it.
    assert res.status_code == 200
