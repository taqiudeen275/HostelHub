"""Accounts views — OTP auth, JWT, user profile endpoints."""
import logging

from django.contrib.auth import authenticate
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import UserRole, StudentProfile, HostelAdminProfile
from .serializers import (
    OTPRequestSerializer,
    OTPVerifySerializer,
    SuperAdminLoginSerializer,
    UserSerializer,
    UserBasicUpdateSerializer,
    StudentProfileSerializer,
    PrivacySettingsSerializer,
    HostelAdminProfileSerializer,
)
from .services import (
    create_otp_record,
    validate_otp,
    get_or_create_user,
    normalize_phone,
)
from .throttling import OTPPhoneRateThrottle, OTPIPRateThrottle
from notifications.services import send_otp_sms

logger = logging.getLogger(__name__)


def _get_tokens_for_user(user):
    """Generate JWT access + refresh token pair for a user."""
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


# ---------------------------------------------------------------------------
# OTP Auth
# ---------------------------------------------------------------------------

class OTPRequestView(APIView):
    """
    POST /api/v1/auth/otp/request/
    Request an OTP for the given phone number.
    Rate limited: 3/phone/15min and 10/IP/hour.
    """
    permission_classes = [AllowAny]
    throttle_classes = [OTPPhoneRateThrottle, OTPIPRateThrottle]

    def post(self, request):
        serializer = OTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone = serializer.validated_data["phone"]
        code, otp_record = create_otp_record(phone)

        # Send OTP via configured adapter (console in dev, Arkesel in prod)
        result = send_otp_sms(phone, code)
        if not result["success"]:
            logger.error("OTP send failed for %s: %s", phone, result.get("error"))
            # Don't expose internal errors — the code is still in DB if needed
            # but in production we'd surface this as a 503

        resend_cooldown = getattr(settings, "OTP_RESEND_COOLDOWN_SECONDS", 60)
        expiry = getattr(settings, "OTP_EXPIRY_SECONDS", 300)

        return Response(
            {
                "message": "OTP sent successfully.",
                "phone": phone,
                "expires_in_seconds": expiry,
                "resend_cooldown_seconds": resend_cooldown,
            },
            status=status.HTTP_200_OK,
        )


class OTPVerifyView(APIView):
    """
    POST /api/v1/auth/otp/verify/
    Verify OTP. On success, returns JWT tokens + user data.
    Creates the user account if this is their first login.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone = serializer.validated_data["phone"]
        code = serializer.validated_data["code"]
        role = serializer.validated_data.get("role", UserRole.STUDENT)

        # Validate OTP
        valid, error_msg = validate_otp(phone, code)
        if not valid:
            return Response(
                {"error": error_msg},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get or create user
        user, created = get_or_create_user(phone, role)

        tokens = _get_tokens_for_user(user)
        user_data = UserSerializer(user, context={"request": request}).data

        return Response(
            {
                "message": "Login successful.",
                "is_new_user": created,
                "tokens": tokens,
                "user": user_data,
            },
            status=status.HTTP_200_OK,
        )


class SuperAdminLoginView(APIView):
    """
    POST /api/v1/auth/superadmin/login/
    Email + password login for Super Admin only.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SuperAdminLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]

        # Look up user by email
        from .models import User
        try:
            user = User.objects.get(email=email, role=UserRole.SUPER_ADMIN)
        except User.DoesNotExist:
            return Response(
                {"error": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Verify password
        if not user.check_password(password):
            return Response(
                {"error": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {"error": "This account has been deactivated."},
                status=status.HTTP_403_FORBIDDEN,
            )

        tokens = _get_tokens_for_user(user)
        user_data = UserSerializer(user, context={"request": request}).data

        return Response(
            {"message": "Login successful.", "tokens": tokens, "user": user_data},
            status=status.HTTP_200_OK,
        )


class TokenRefreshView(APIView):
    """
    POST /api/v1/auth/refresh/
    Exchange a refresh token for a new access token.
    SimpleJWT handles rotation and blacklisting automatically.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"error": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            refresh = RefreshToken(refresh_token)
            return Response(
                {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),   # rotated token
                },
                status=status.HTTP_200_OK,
            )
        except TokenError as e:
            return Response(
                {"error": "Invalid or expired refresh token.", "detail": str(e)},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Blacklist the provided refresh token, invalidating the session.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"error": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)
        except TokenError:
            return Response({"error": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Profile endpoints
# ---------------------------------------------------------------------------

class MeView(APIView):
    """
    GET  /api/v1/auth/me/  — current user + role-specific profile
    PATCH /api/v1/auth/me/ — update first_name, last_name
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user, context={"request": request})
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserBasicUpdateSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user, context={"request": request}).data)


class StudentProfileView(APIView):
    """
    PATCH /api/v1/me/student-profile/
    Update extended student profile (program, level, gender, profile photo).
    """
    permission_classes = [IsAuthenticated]

    def get_profile(self, user):
        profile, _ = StudentProfile.objects.get_or_create(user=user)
        return profile

    def get(self, request):
        if request.user.role != UserRole.STUDENT:
            return Response(
                {"error": "Only students have this profile."},
                status=status.HTTP_403_FORBIDDEN,
            )
        profile = self.get_profile(request.user)
        return Response(StudentProfileSerializer(profile).data)

    def patch(self, request):
        if request.user.role != UserRole.STUDENT:
            return Response(
                {"error": "Only students have this profile."},
                status=status.HTTP_403_FORBIDDEN,
            )
        profile = self.get_profile(request.user)
        serializer = StudentProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PrivacySettingsView(APIView):
    """
    GET/PATCH /api/v1/me/privacy/
    Manage field-level visibility of roommate information.
    Students only.
    """
    permission_classes = [IsAuthenticated]

    def get_profile(self, user):
        profile, _ = StudentProfile.objects.get_or_create(user=user)
        return profile

    def get(self, request):
        if request.user.role != UserRole.STUDENT:
            return Response(
                {"error": "Only students have privacy settings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        profile = self.get_profile(request.user)
        return Response(PrivacySettingsSerializer(profile).data)

    def patch(self, request):
        if request.user.role != UserRole.STUDENT:
            return Response(
                {"error": "Only students have privacy settings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        profile = self.get_profile(request.user)
        serializer = PrivacySettingsSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class HostelAdminProfileView(APIView):
    """
    GET/PATCH /api/v1/me/admin-profile/
    Update hostel admin business info.
    """
    permission_classes = [IsAuthenticated]

    def get_profile(self, user):
        profile, _ = HostelAdminProfile.objects.get_or_create(user=user)
        return profile

    def get(self, request):
        if request.user.role != UserRole.HOSTEL_ADMIN:
            return Response(
                {"error": "Only hostel admins have this profile."},
                status=status.HTTP_403_FORBIDDEN,
            )
        profile = self.get_profile(request.user)
        return Response(HostelAdminProfileSerializer(profile).data)

    def patch(self, request):
        if request.user.role != UserRole.HOSTEL_ADMIN:
            return Response(
                {"error": "Only hostel admins have this profile."},
                status=status.HTTP_403_FORBIDDEN,
            )
        profile = self.get_profile(request.user)
        serializer = HostelAdminProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
