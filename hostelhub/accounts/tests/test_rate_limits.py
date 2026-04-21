"""Tests for OTP rate limiting and resend cooldown — FR-1.2, FR-1.5."""
import pytest
from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APIClient


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

    def test_first_request_succeeds(self):
        """First OTP request for a phone should always succeed."""
        client = APIClient()
        response = self._make_request(client, phone="+233244100010")
        assert response.status_code == 200, response.data

    def test_immediate_resend_blocked_by_cooldown(self):
        """
        A second back-to-back request for the same phone within the cooldown
        window is rejected with 429 and includes retry_after_seconds.
        """
        client = APIClient()
        phone = "+233244100011"
        # First request succeeds
        res1 = self._make_request(client, phone)
        assert res1.status_code == 200

        # Immediate second request — same phone, OTP still valid → cooldown blocks it
        res2 = self._make_request(client, phone)
        assert res2.status_code == 429
        assert "retry_after_seconds" in res2.data

    def test_resend_allowed_after_cooldown_expires(self):
        """
        A resend after the cooldown window passes should succeed.
        We back-date the existing OTP's created_at to simulate the wait.
        """
        from accounts.models import OTPCode

        client = APIClient()
        phone = "+233244100012"

        # First request
        with patch("accounts.views.send_otp_sms", return_value={"success": True}):
            res = client.post(self.OTP_REQUEST_URL, {"phone": phone}, format="json")
        assert res.status_code == 200

        # Manually push the OTP's created_at back past the cooldown
        otp = OTPCode.objects.filter(phone=phone).latest("created_at")
        otp.created_at = timezone.now() - timedelta(seconds=61)
        otp.save(update_fields=["created_at"])

        # Second request should now succeed
        with patch("accounts.views.send_otp_sms", return_value={"success": True}):
            res2 = client.post(self.OTP_REQUEST_URL, {"phone": phone}, format="json")
        assert res2.status_code == 200

    def test_phone_throttle_blocks_after_three_distinct_windows(self):
        """
        Phone-level throttle (3/15min) is separate from the cooldown.
        Send 3 requests with cooldown bypassed, then 4th must be 429.
        """
        from accounts.models import OTPCode

        client = APIClient()
        phone = "+233244100013"

        for i in range(3):
            with patch("accounts.views.send_otp_sms", return_value={"success": True}):
                res = client.post(self.OTP_REQUEST_URL, {"phone": phone}, format="json")
            assert res.status_code == 200, f"Request {i+1} should succeed: {res.data}"
            # Push all existing OTPs past cooldown so next request isn't blocked by cooldown
            OTPCode.objects.filter(phone=phone).update(
                created_at=timezone.now() - timedelta(seconds=61)
            )

        # 4th request — throttle kicks in
        with patch("accounts.views.send_otp_sms", return_value={"success": True}):
            res4 = client.post(self.OTP_REQUEST_URL, {"phone": phone}, format="json")
        assert res4.status_code == 429

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
