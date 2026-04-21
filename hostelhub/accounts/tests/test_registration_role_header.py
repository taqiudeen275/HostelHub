"""Tests that OTP verify honours the X-HMS-Registration-Role header (PRD §8.1)."""
import pytest
from unittest.mock import patch
from rest_framework.test import APIClient

from accounts.models import User, UserRole
from accounts.services import create_otp_record


@pytest.fixture(autouse=True)
def _silence_sms():
    with patch("accounts.views.send_otp_sms", return_value={"success": True}):
        yield


def _verify(client, phone, code, header_role=None, body_role=None):
    headers = {}
    if header_role is not None:
        headers["HTTP_X_HMS_REGISTRATION_ROLE"] = header_role
    payload = {"phone": phone, "code": code}
    if body_role is not None:
        payload["role"] = body_role
    return client.post("/api/v1/auth/otp/verify/", payload, format="json", **headers)


@pytest.mark.django_db
class TestRegistrationRoleHeader:
    def test_header_creates_hostel_admin(self):
        phone = "+233244700001"
        code, _ = create_otp_record(phone)
        client = APIClient()
        res = _verify(client, phone, code, header_role="HOSTEL_ADMIN")
        assert res.status_code == 200
        assert User.objects.get(phone=phone).role == UserRole.HOSTEL_ADMIN

    def test_header_creates_student_by_default(self):
        phone = "+233244700002"
        code, _ = create_otp_record(phone)
        client = APIClient()
        res = _verify(client, phone, code)
        assert res.status_code == 200
        assert User.objects.get(phone=phone).role == UserRole.STUDENT

    def test_header_wins_over_body(self):
        """If both are present, the header takes precedence."""
        phone = "+233244700003"
        code, _ = create_otp_record(phone)
        client = APIClient()
        res = _verify(client, phone, code, header_role="HOSTEL_ADMIN", body_role="STUDENT")
        assert res.status_code == 200
        assert User.objects.get(phone=phone).role == UserRole.HOSTEL_ADMIN

    def test_invalid_header_falls_back_to_body(self):
        phone = "+233244700004"
        code, _ = create_otp_record(phone)
        client = APIClient()
        res = _verify(client, phone, code, header_role="HACKER", body_role="HOSTEL_ADMIN")
        assert res.status_code == 200
        assert User.objects.get(phone=phone).role == UserRole.HOSTEL_ADMIN
