"""Accounts models: User, StudentProfile, HostelAdminProfile, OTPCode."""
import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from .managers import UserManager


class UserRole(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
    HOSTEL_ADMIN = "HOSTEL_ADMIN", "Hostel Admin"
    STUDENT = "STUDENT", "Student"


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model using phone as the primary identifier.
    Super Admin may additionally set an email for email+password login.
    Students and Hostel Admins are phone+OTP only — no password needed.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone = models.CharField(max_length=20, unique=True, db_index=True)
    email = models.EmailField(blank=True, null=True, unique=True)
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.STUDENT)

    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)

    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)   # True after first OTP verify
    is_staff = models.BooleanField(default=False)      # Django admin access

    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = ["role"]

    objects = UserManager()

    class Meta:
        db_table = "accounts_user"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return f"{self.phone} ({self.role})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def is_super_admin(self):
        return self.role == UserRole.SUPER_ADMIN

    @property
    def is_hostel_admin(self):
        return self.role == UserRole.HOSTEL_ADMIN

    @property
    def is_student(self):
        return self.role == UserRole.STUDENT


class StudentLevelChoices(models.TextChoices):
    LEVEL_100 = "100", "Level 100"
    LEVEL_200 = "200", "Level 200"
    LEVEL_300 = "300", "Level 300"
    LEVEL_400 = "400", "Level 400"
    MASTERS = "MASTERS", "Masters"
    PHD = "PHD", "PhD"


class PrivacyChoice(models.TextChoices):
    NOBODY = "NOBODY", "Nobody"
    ROOMMATES = "ROOMMATES", "Roommates Only"
    HOSTELMATES = "HOSTELMATES", "Anyone in My Hostel"


class StudentProfile(models.Model):
    """Extended profile data for STUDENT-role users."""
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="student_profile"
    )
    program = models.CharField(max_length=200, blank=True)
    level = models.CharField(
        max_length=10, choices=StudentLevelChoices.choices, blank=True
    )
    gender = models.CharField(max_length=20, blank=True)
    profile_photo = models.ImageField(
        upload_to="profiles/", null=True, blank=True
    )

    # Privacy settings — field-level visibility toggles
    privacy_phone = models.CharField(
        max_length=20, choices=PrivacyChoice.choices, default=PrivacyChoice.ROOMMATES
    )
    privacy_full_name = models.CharField(
        max_length=20, choices=PrivacyChoice.choices, default=PrivacyChoice.ROOMMATES
    )
    privacy_photo = models.CharField(
        max_length=20, choices=PrivacyChoice.choices, default=PrivacyChoice.ROOMMATES
    )

    class Meta:
        db_table = "accounts_student_profile"

    def __str__(self):
        return f"StudentProfile({self.user.phone})"


class HostelAdminProfile(models.Model):
    """Extended profile data for HOSTEL_ADMIN-role users."""
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="hostel_admin_profile"
    )
    business_name = models.CharField(max_length=255, blank=True)
    whatsapp_number = models.CharField(max_length=20, blank=True)
    id_document = models.FileField(
        upload_to="kyc/", null=True, blank=True
    )
    # True if this admin was onboarded by Super Admin and needs tech setup help
    is_tech_setup_required = models.BooleanField(default=False)

    class Meta:
        db_table = "accounts_hostel_admin_profile"

    def __str__(self):
        return f"HostelAdminProfile({self.user.phone})"


class OTPCode(models.Model):
    """
    Stores a single pending OTP for a phone number.
    Only the hash (SHA-256) of the code is stored — never the raw code.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone = models.CharField(max_length=20, db_index=True)
    code_hash = models.CharField(max_length=64)   # SHA-256 hex digest
    attempts = models.PositiveSmallIntegerField(default=0)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_otp_code"
        ordering = ["-created_at"]

    def __str__(self):
        return f"OTP({self.phone}, expires={self.expires_at})"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_consumed(self):
        return self.consumed_at is not None
