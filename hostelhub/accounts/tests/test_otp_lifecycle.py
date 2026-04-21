"""Tests for the OTP lifecycle — FR-1.2."""
import pytest
from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from accounts.services import (
    create_otp_record,
    validate_otp,
    hash_otp,
    verify_otp_hash,
)
from accounts.models import OTPCode


@pytest.mark.django_db
class TestOTPCreation:
    def test_creates_otp_record(self):
        code, otp = create_otp_record("+233244123456")
        assert otp.pk is not None
        assert len(code) == 6
        assert code.isdigit()

    def test_stores_hash_not_plaintext(self):
        code, otp = create_otp_record("+233244123456")
        assert otp.code_hash != code
        assert verify_otp_hash(code, otp.code_hash)

    def test_otp_not_yet_expired(self):
        _, otp = create_otp_record("+233244123456")
        assert not otp.is_expired

    def test_otp_not_consumed_on_create(self):
        _, otp = create_otp_record("+233244123456")
        assert not otp.is_consumed


@pytest.mark.django_db
class TestOTPValidation:
    def test_happy_path(self):
        phone = "+233244111111"
        code, otp = create_otp_record(phone)
        valid, error = validate_otp(phone, code)
        assert valid is True
        assert error is None

    def test_consumed_after_success(self):
        phone = "+233244111112"
        code, _ = create_otp_record(phone)
        validate_otp(phone, code)
        otp = OTPCode.objects.filter(phone=phone).latest("created_at")
        assert otp.is_consumed

    def test_wrong_code_rejected(self):
        phone = "+233244111113"
        create_otp_record(phone)
        valid, error = validate_otp(phone, "000000")
        assert valid is False
        assert "Incorrect code" in error

    def test_wrong_code_increments_attempts(self):
        phone = "+233244111114"
        _, otp = create_otp_record(phone)
        validate_otp(phone, "000000")
        otp.refresh_from_db()
        assert otp.attempts == 1

    def test_expired_otp_rejected(self):
        phone = "+233244111115"
        _, otp = create_otp_record(phone)
        # Manually expire the OTP
        otp.expires_at = timezone.now() - timedelta(seconds=1)
        otp.save()
        valid, error = validate_otp(phone, "123456")
        assert valid is False
        assert "expired" in error.lower()

    def test_max_attempts_lockout(self):
        phone = "+233244111116"
        code, otp = create_otp_record(phone)
        # Exhaust attempts
        otp.attempts = 5
        otp.save()
        valid, error = validate_otp(phone, code)
        assert valid is False
        assert "Too many" in error

    def test_no_otp_requested(self):
        phone = "+233244999999"  # never requested OTP
        valid, error = validate_otp(phone, "123456")
        assert valid is False
        assert "No OTP" in error

    def test_second_verify_of_same_code_fails(self):
        """OTP can only be consumed once."""
        phone = "+233244111117"
        code, _ = create_otp_record(phone)
        valid1, _ = validate_otp(phone, code)
        valid2, error = validate_otp(phone, code)
        assert valid1 is True
        assert valid2 is False  # consumed_at is set, new lookup finds no unconsumed OTP
