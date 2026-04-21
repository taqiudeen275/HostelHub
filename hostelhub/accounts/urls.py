"""Accounts URL configuration."""
from django.urls import path

from .views import (
    OTPRequestView,
    OTPVerifyView,
    SuperAdminLoginView,
    TokenRefreshView,
    LogoutView,
    MeView,
    StudentProfileView,
    PrivacySettingsView,
    HostelAdminProfileView,
)

urlpatterns = [
    # Auth
    path("auth/otp/request/", OTPRequestView.as_view(), name="otp-request"),
    path("auth/otp/verify/", OTPVerifyView.as_view(), name="otp-verify"),
    path("auth/superadmin/login/", SuperAdminLoginView.as_view(), name="superadmin-login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/me/", MeView.as_view(), name="me"),

    # Profile endpoints
    path("me/student-profile/", StudentProfileView.as_view(), name="student-profile"),
    path("me/privacy/", PrivacySettingsView.as_view(), name="privacy-settings"),
    path("me/admin-profile/", HostelAdminProfileView.as_view(), name="admin-profile"),
]
