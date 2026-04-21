"""Tests for role-based access control and profile endpoints."""
import pytest
from unittest.mock import patch
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User, UserRole


def make_user(phone, role, **kwargs):
    """Helper to create an active, verified user."""
    user = User.objects.create_user(phone=phone, role=role, **kwargs)
    user.is_verified = True
    user.save()
    return user


def auth_client(user):
    """Return an APIClient authenticated as the given user."""
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return client


@pytest.mark.django_db
class TestRoleIsolation:
    def test_student_cannot_access_admin_profile(self):
        user = make_user("+233244300001", UserRole.STUDENT)
        client = auth_client(user)
        response = client.get("/api/v1/me/admin-profile/")
        assert response.status_code == 403

    def test_hostel_admin_cannot_access_student_profile(self):
        user = make_user("+233244300002", UserRole.HOSTEL_ADMIN)
        client = auth_client(user)
        response = client.get("/api/v1/me/student-profile/")
        assert response.status_code == 403

    def test_student_cannot_access_privacy_as_admin(self):
        user = make_user("+233244300003", UserRole.HOSTEL_ADMIN)
        client = auth_client(user)
        response = client.get("/api/v1/me/privacy/")
        assert response.status_code == 403

    def test_unauthenticated_cannot_access_me(self):
        client = APIClient()
        response = client.get("/api/v1/auth/me/")
        assert response.status_code == 401

    def test_student_can_access_own_me(self):
        user = make_user("+233244300004", UserRole.STUDENT)
        client = auth_client(user)
        response = client.get("/api/v1/auth/me/")
        assert response.status_code == 200
        assert response.data["phone"] == "+233244300004"
        assert response.data["role"] == UserRole.STUDENT


@pytest.mark.django_db
class TestPrivacySettings:
    def test_student_can_get_own_privacy(self):
        user = make_user("+233244400001", UserRole.STUDENT)
        client = auth_client(user)
        response = client.get("/api/v1/me/privacy/")
        assert response.status_code == 200
        assert "privacy_phone" in response.data

    def test_student_can_update_privacy(self):
        user = make_user("+233244400002", UserRole.STUDENT)
        client = auth_client(user)
        response = client.patch(
            "/api/v1/me/privacy/",
            {"privacy_phone": "NOBODY", "privacy_full_name": "HOSTELMATES"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["privacy_phone"] == "NOBODY"
        assert response.data["privacy_full_name"] == "HOSTELMATES"

    def test_invalid_privacy_value_rejected(self):
        user = make_user("+233244400003", UserRole.STUDENT)
        client = auth_client(user)
        response = client.patch(
            "/api/v1/me/privacy/",
            {"privacy_phone": "INVALID_VALUE"},
            format="json",
        )
        assert response.status_code == 400


@pytest.mark.django_db
class TestMeEndpoint:
    def test_me_returns_is_onboarding_complete_false_for_new_user(self):
        user = make_user("+233244500001", UserRole.STUDENT)
        client = auth_client(user)
        response = client.get("/api/v1/auth/me/")
        assert response.status_code == 200
        assert response.data["is_onboarding_complete"] is False

    def test_me_returns_is_onboarding_complete_true_after_name_set(self):
        user = make_user("+233244500002", UserRole.STUDENT, first_name="Ama")
        client = auth_client(user)
        response = client.get("/api/v1/auth/me/")
        assert response.data["is_onboarding_complete"] is True

    def test_me_patch_updates_name(self):
        user = make_user("+233244500003", UserRole.STUDENT)
        client = auth_client(user)
        response = client.patch(
            "/api/v1/auth/me/",
            {"first_name": "Kwame", "last_name": "Mensah"},
            format="json",
        )
        assert response.status_code == 200
        user.refresh_from_db()
        assert user.first_name == "Kwame"
