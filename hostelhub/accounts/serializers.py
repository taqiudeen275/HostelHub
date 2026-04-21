"""Accounts serializers."""
from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from .models import User, UserRole, StudentProfile, HostelAdminProfile, PrivacyChoice
from .services import normalize_phone


class OTPRequestSerializer(serializers.Serializer):
    """Validates the phone number for OTP requests."""
    phone = serializers.CharField(max_length=20)

    def validate_phone(self, value):
        try:
            return normalize_phone(value)
        except ValueError as e:
            raise serializers.ValidationError(str(e))


class OTPVerifySerializer(serializers.Serializer):
    """Validates the phone + OTP code for verification."""
    phone = serializers.CharField(max_length=20)
    code = serializers.CharField(min_length=6, max_length=6)
    # Role is used only on first verify (registration). Subsequent logins ignore it.
    role = serializers.ChoiceField(
        choices=[UserRole.STUDENT, UserRole.HOSTEL_ADMIN],
        default=UserRole.STUDENT,
        required=False,
    )

    def validate_phone(self, value):
        try:
            return normalize_phone(value)
        except ValueError as e:
            raise serializers.ValidationError(str(e))

    def validate_code(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("OTP must contain digits only.")
        return value


class SuperAdminLoginSerializer(serializers.Serializer):
    """Email + password login for Super Admin."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class StudentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentProfile
        fields = [
            "program", "level", "gender", "profile_photo",
            "privacy_phone", "privacy_full_name", "privacy_photo",
        ]
        read_only_fields = []


class PrivacySettingsSerializer(serializers.ModelSerializer):
    """Focused serializer just for the privacy toggles."""
    class Meta:
        model = StudentProfile
        fields = ["privacy_phone", "privacy_full_name", "privacy_photo"]


class HostelAdminProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = HostelAdminProfile
        fields = ["business_name", "whatsapp_number", "id_document", "is_tech_setup_required"]
        read_only_fields = ["is_tech_setup_required"]


class UserSerializer(serializers.ModelSerializer):
    """Read-only user serializer. Embeds role-appropriate profile."""
    student_profile = StudentProfileSerializer(read_only=True)
    hostel_admin_profile = HostelAdminProfileSerializer(read_only=True)
    full_name = serializers.CharField(read_only=True)
    is_onboarding_complete = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "phone", "email", "role", "first_name", "last_name", "full_name",
            "is_active", "is_verified", "date_joined",
            "student_profile", "hostel_admin_profile",
            "is_onboarding_complete",
        ]
        read_only_fields = fields

    def get_is_onboarding_complete(self, obj):
        """
        Returns False if the user has never filled in their first name.
        Frontend uses this to redirect to the onboarding page after first login.
        """
        return bool(obj.first_name)


class UserBasicUpdateSerializer(serializers.ModelSerializer):
    """Allows users to update their own first/last name."""
    class Meta:
        model = User
        fields = ["first_name", "last_name"]
