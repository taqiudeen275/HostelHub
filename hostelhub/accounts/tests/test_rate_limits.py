"""Tests for OTP rate limiting endpoints — FR-1.5."""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from unittest.mock import patch


@pytest.fixture
def client():
    return APIClient()


@pytest.mark.django_db
class TestOTPRateLimits:
    OTP_REQUEST_URL = "/api/v1/auth/otp/request/"

    def _make_request(self, client, phone="+233244123456"):
        with patch("accounts.views.send_otp_sms", return_value={"success": True}):
            return client.post(
                self.OTP_REQUEST_URL,
                {"phone": phone},
                format="json",
            )

    def test_first_three_requests_succeed(self):
        """First 3 OTP requests for the same phone should succeed."""
        client = APIClient()
        phone = "+233244100001"
        for _ in range(3):
            response = self._make_request(client, phone)
            assert response.status_code == 200, response.data

    def test_fourth_request_throttled(self):
        """4th OTP request for same phone within 15min should be 429."""
        client = APIClient()
        phone = "+233244100002"
        for _ in range(3):
            self._make_request(client, phone)
        response = self._make_request(client, phone)
        assert response.status_code == 429

    def test_invalid_phone_returns_400(self):
        """Invalid phone number should return 400, not 200."""
        client = APIClient()
        response = client.post(
            self.OTP_REQUEST_URL,
            {"phone": "not-a-phone"},
            format="json",
        )
        assert response.status_code == 400


@pytest.mark.django_db
class TestOTPVerifyEndpoint:
    VERIFY_URL = "/api/v1/auth/otp/verify/"
    REQUEST_URL = "/api/v1/auth/otp/request/"

    def test_happy_path_returns_tokens(self):
        client = APIClient()
        phone = "+233244200001"
        with patch("accounts.views.send_otp_sms", return_value={"success": True}):
            client.post(self.REQUEST_URL, {"phone": phone}, format="json")

        # Get the plaintext code from DB
        from accounts.models import OTPCode
        otp = OTPCode.objects.filter(phone=phone).latest("created_at")
        # We can't reverse the hash, so patch validate_otp instead
        with patch("accounts.views.validate_otp", return_value=(True, None)):
            with patch("accounts.services.get_or_create_user") as mock_user:
                from accounts.models import User, UserRole
                import uuid
                mock = User(id=uuid.uuid4(), phone=phone, role=UserRole.STUDENT)
                mock.is_verified = True
                mock_user.return_value = (mock, True)
                response = client.post(
                    self.VERIFY_URL,
                    {"phone": phone, "code": "123456", "role": "STUDENT"},
                    format="json",
                )
        assert response.status_code == 200
        assert "tokens" in response.data
        assert "access" in response.data["tokens"]
        assert "refresh" in response.data["tokens"]

    def test_wrong_code_returns_400(self):
        client = APIClient()
        phone = "+233244200002"
        with patch("accounts.views.send_otp_sms", return_value={"success": True}):
            client.post(self.REQUEST_URL, {"phone": phone}, format="json")
        response = client.post(
            self.VERIFY_URL,
            {"phone": phone, "code": "000000", "role": "STUDENT"},
            format="json",
        )
        assert response.status_code == 400
