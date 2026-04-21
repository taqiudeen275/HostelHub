"""Tests for profile photo upload and Pillow resize — GAP-8 (Week 3 spec)."""
import io
import pytest
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User, UserRole, StudentProfile


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(phone, role, **kwargs):
    user = User.objects.create_user(phone=phone, role=role, **kwargs)
    user.is_verified = True
    user.save()
    return user


def auth_client(user):
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return client


def make_test_image(width=800, height=600, fmt="JPEG") -> SimpleUploadedFile:
    """Create an in-memory image file suitable for multipart upload."""
    buf = io.BytesIO()
    img = Image.new("RGB", (width, height), color=(255, 100, 50))
    img.save(buf, format=fmt)
    buf.seek(0)
    ext = "jpg" if fmt == "JPEG" else fmt.lower()
    return SimpleUploadedFile(
        f"test_photo.{ext}",
        buf.read(),
        content_type=f"image/{fmt.lower()}",
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestProfilePhotoUpload:
    PROFILE_URL = "/api/v1/me/student-profile/"

    def test_upload_photo_stores_file(self, settings, tmp_path):
        """PATCHing profile_photo stores the file and returns a URL."""
        settings.MEDIA_ROOT = tmp_path
        user = make_user("+233244600001", UserRole.STUDENT)
        client = auth_client(user)

        image = make_test_image()
        response = client.patch(
            self.PROFILE_URL,
            {"profile_photo": image},
            format="multipart",
        )
        assert response.status_code == 200, response.data
        # profile_photo field should now be a non-empty URL/path
        assert response.data["profile_photo"] is not None
        assert response.data["profile_photo"] != ""

    def test_uploaded_photo_is_resized(self, settings, tmp_path):
        """Photos larger than 512px on the longest edge are resized down."""
        settings.MEDIA_ROOT = tmp_path
        user = make_user("+233244600002", UserRole.STUDENT)
        client = auth_client(user)

        # Upload a 1200×900 image — should be resized to max 512px
        image = make_test_image(width=1200, height=900)
        response = client.patch(
            self.PROFILE_URL,
            {"profile_photo": image},
            format="multipart",
        )
        assert response.status_code == 200

        profile = StudentProfile.objects.get(user=user)
        assert profile.profile_photo, "profile_photo should not be empty after upload"

        with Image.open(profile.profile_photo.path) as img:
            max_dim = max(img.width, img.height)
            assert max_dim <= 512, (
                f"Expected longest edge ≤512px after resize, got {max_dim}px "
                f"({img.width}×{img.height})"
            )

    def test_small_image_not_upscaled(self, settings, tmp_path):
        """Images smaller than 512px are stored as-is (not upscaled)."""
        settings.MEDIA_ROOT = tmp_path
        user = make_user("+233244600003", UserRole.STUDENT)
        client = auth_client(user)

        image = make_test_image(width=200, height=150)
        response = client.patch(
            self.PROFILE_URL,
            {"profile_photo": image},
            format="multipart",
        )
        assert response.status_code == 200

        profile = StudentProfile.objects.get(user=user)
        with Image.open(profile.profile_photo.path) as img:
            # Should not have been upscaled — dimensions should stay ≤200×150
            assert img.width <= 200
            assert img.height <= 150

    def test_non_student_cannot_upload_photo(self, settings, tmp_path):
        """A Hostel Admin hitting /me/student-profile/ gets 403."""
        settings.MEDIA_ROOT = tmp_path
        user = make_user("+233244600004", UserRole.HOSTEL_ADMIN)
        client = auth_client(user)

        image = make_test_image()
        response = client.patch(
            self.PROFILE_URL,
            {"profile_photo": image},
            format="multipart",
        )
        assert response.status_code == 403
