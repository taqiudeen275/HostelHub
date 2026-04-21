"""Tests for phone number normalization — FR-1.3."""
import pytest
from accounts.services import normalize_phone


class TestPhoneNormalization:
    """Phone numbers must normalize to E.164 (+233XXXXXXXXX) regardless of input format."""

    def test_local_format_zero_prefix(self):
        """0244123456 → +233244123456"""
        assert normalize_phone("0244123456") == "+233244123456"

    def test_e164_format_already_correct(self):
        """+233244123456 → +233244123456 (unchanged)"""
        assert normalize_phone("+233244123456") == "+233244123456"

    def test_country_code_without_plus(self):
        """233244123456 → +233244123456"""
        assert normalize_phone("233244123456") == "+233244123456"

    def test_strips_spaces(self):
        """0244 123 456 → +233244123456"""
        assert normalize_phone("0244 123 456") == "+233244123456"

    def test_strips_hyphens(self):
        """0244-123-456 → +233244123456"""
        assert normalize_phone("0244-123-456") == "+233244123456"

    def test_mtn_number(self):
        """MTN Ghana 024x numbers."""
        assert normalize_phone("0241111111") == "+233241111111"

    def test_vodafone_number(self):
        """Vodafone/Telecel Ghana 020x numbers."""
        assert normalize_phone("0201234567") == "+233201234567"

    def test_airteltigo_number(self):
        """AirtelTigo Ghana 026x numbers."""
        assert normalize_phone("0261234567") == "+233261234567"

    def test_invalid_too_short_raises(self):
        with pytest.raises(ValueError, match="Invalid phone number"):
            normalize_phone("12345")

    def test_invalid_letters_raises(self):
        with pytest.raises(ValueError):
            normalize_phone("abcdefgh")

    def test_empty_string_raises(self):
        with pytest.raises(ValueError):
            normalize_phone("")
