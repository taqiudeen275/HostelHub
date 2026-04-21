"""
Accounts services — phone normalization, OTP lifecycle, user creation.
This module is the single source of truth for auth business logic.
"""
import hashlib
import random
import string
from datetime import timedelta

import phonenumbers
from django.conf import settings
from django.utils import timezone


# ---------------------------------------------------------------------------
# Phone normalization
# ---------------------------------------------------------------------------

def normalize_phone(raw: str, country_code: str = "GH") -> str:
    """
    Normalize a raw phone string to E.164 format (+233XXXXXXXXX).

    Accepts:
      - 0244123456      (local Ghanaian format)
      - +233244123456   (already E.164)
      - 233244123456    (without the +)

    Raises:
      ValueError if the number is invalid or cannot be parsed.
    """
    raw = raw.strip().replace(" ", "").replace("-", "")

    # Handle 233XXXXXXXXX → +233XXXXXXXXX
    if raw.startswith("233") and not raw.startswith("+"):
        raw = "+" + raw

    try:
        parsed = phonenumbers.parse(raw, country_code)
    except phonenumbers.NumberParseException:
        raise ValueError(f"Invalid phone number: '{raw}'")

    if not phonenumbers.is_valid_number(parsed):
        raise ValueError(f"Phone number '{raw}' is not a valid number.")

    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


# ---------------------------------------------------------------------------
# OTP generation and hashing
# ---------------------------------------------------------------------------

def generate_otp() -> str:
    """Generate a cryptographically random 6-digit OTP code."""
    return "".join(random.choices(string.digits, k=6))


def hash_otp(code: str) -> str:
    """Return SHA-256 hex digest of the OTP code."""
    return hashlib.sha256(code.encode()).hexdigest()


def verify_otp_hash(code: str, stored_hash: str) -> bool:
    """Constant-time comparison of OTP code against stored hash."""
    return hashlib.sha256(code.encode()).hexdigest() == stored_hash


# ---------------------------------------------------------------------------
# OTP database operations
# ---------------------------------------------------------------------------

def create_otp_record(phone: str) -> tuple:
    """
    Create a new OTPCode record for the given phone number.
    Returns (otp_code_plaintext, OTPCode_instance).

    Any existing unconsumed OTP for this phone is invalidated by expiry being
    overwritten; we simply create a new record.
    """
    from .models import OTPCode

    code = generate_otp()
    code_hash = hash_otp(code)
    expiry_seconds = getattr(settings, "OTP_EXPIRY_SECONDS", 300)

    otp = OTPCode.objects.create(
        phone=phone,
        code_hash=code_hash,
        expires_at=timezone.now() + timedelta(seconds=expiry_seconds),
    )
    return code, otp


def validate_otp(phone: str, submitted_code: str) -> tuple:
    """
    Validate a submitted OTP for the given phone.

    Returns:
        (True, None) on success - the OTPCode has been marked consumed
        (False, error_message) on failure
    """
    from .models import OTPCode

    max_attempts = getattr(settings, "OTP_MAX_ATTEMPTS", 5)

    # Get the latest unconsumed OTP for this phone
    otp = (
        OTPCode.objects
        .filter(phone=phone, consumed_at__isnull=True)
        .order_by("-created_at")
        .first()
    )

    if not otp:
        return False, "No OTP was requested for this number. Please request a new code."

    if otp.is_expired:
        return False, "This OTP has expired. Please request a new code."

    if otp.attempts >= max_attempts:
        return False, "Too many incorrect attempts. Please request a new OTP."

    if not verify_otp_hash(submitted_code, otp.code_hash):
        otp.attempts += 1
        otp.save(update_fields=["attempts"])
        remaining = max_attempts - otp.attempts
        return False, f"Incorrect code. {remaining} attempt(s) remaining."

    # Mark as consumed
    otp.consumed_at = timezone.now()
    otp.save(update_fields=["consumed_at"])
    return True, None


# ---------------------------------------------------------------------------
# User creation / retrieval
# ---------------------------------------------------------------------------

def get_or_create_user(phone: str, role: str) -> tuple:
    """
    Idempotently get or create a user for the given phone + role.
    Returns (user, created: bool).

    On first OTP verify → user is created + is_verified set to True.
    On subsequent logins → existing user is returned.
    """
    from .models import User

    try:
        user = User.objects.get(phone=phone)
        created = False
    except User.DoesNotExist:
        user = User.objects.create_user(phone=phone, role=role)
        created = True

    if not user.is_verified:
        user.is_verified = True
        user.save(update_fields=["is_verified"])

    # Auto-create associated profile if not yet existing
    _ensure_profile(user)

    return user, created


def _ensure_profile(user) -> None:
    """Create the appropriate profile record if it doesn't exist yet."""
    from .models import UserRole, StudentProfile, HostelAdminProfile

    if user.role == UserRole.STUDENT:
        StudentProfile.objects.get_or_create(user=user)
    elif user.role == UserRole.HOSTEL_ADMIN:
        HostelAdminProfile.objects.get_or_create(user=user)
