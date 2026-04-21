"""
Week 5 media tests (GAP-M2-13):
    - Oversized image rejected (>10MB)
    - Oversized video rejected (>50MB)
    - Non-image/video MIME rejected
    - Photo thumbnails generated at 400px and 1000px
    - display_order auto-increments on upload
    - Reorder endpoint persists new order
    - Delete removes files and DB record
"""
import io
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User
from hostels.models import Hostel, HostelMedia, HostelStatus, MediaType


def make_admin(phone: str) -> User:
    return User.objects.create_user(phone=phone, role='HOSTEL_ADMIN', first_name="Tester")


def create_hostel(owner: User) -> Hostel:
    return Hostel.objects.create(
        owner=owner,
        name="Test Hostel",
        description="desc",
        address_text="1 St.",
        owner_contact_phone="+233244000001",
        status=HostelStatus.DRAFT,
    )


def auth_client(user: User) -> APIClient:
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token)}")
    return client


def make_jpeg(width=200, height=200) -> SimpleUploadedFile:
    img = Image.new("RGB", (width, height), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return SimpleUploadedFile("photo.jpg", buf.read(), content_type="image/jpeg")


class TestMediaValidation(TestCase):
    def setUp(self):
        self.admin = make_admin("+233244010001")
        self.hostel = create_hostel(self.admin)
        self.client = auth_client(self.admin)
        self.url = f"/api/v1/admin/hostels/{self.hostel.id}/media/"

    def test_oversized_image_rejected(self):
        """Images over 10MB must be rejected with 400."""
        big = SimpleUploadedFile(
            "big.jpg",
            b"x" * (10 * 1024 * 1024 + 1),
            content_type="image/jpeg",
        )
        res = self.client.post(self.url, {"file": big}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertIn("10MB", res.json()["error"])

    def test_oversized_video_rejected(self):
        """Videos over 50MB must be rejected with 400."""
        big = SimpleUploadedFile(
            "big.mp4",
            b"x" * (50 * 1024 * 1024 + 1),
            content_type="video/mp4",
        )
        res = self.client.post(self.url, {"file": big}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertIn("50MB", res.json()["error"])

    def test_non_media_mime_rejected(self):
        """PDF upload must be rejected with 400."""
        pdf = SimpleUploadedFile("doc.pdf", b"%PDF-1.4", content_type="application/pdf")
        res = self.client.post(self.url, {"file": pdf}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Unsupported", res.json()["error"])

    def test_no_file_returns_400(self):
        """Missing file field returns 400."""
        res = self.client.post(self.url, {}, format="multipart")
        self.assertEqual(res.status_code, 400)


class TestThumbnailGeneration(TestCase):
    def setUp(self):
        self.admin = make_admin("+233244010002")
        self.hostel = create_hostel(self.admin)
        self.client = auth_client(self.admin)
        self.url = f"/api/v1/admin/hostels/{self.hostel.id}/media/"

    def test_photo_thumbnails_generated(self):
        """Uploading a JPEG photo should create 400px and 1000px thumbnails."""
        f = make_jpeg(1200, 900)
        res = self.client.post(self.url, {"file": f}, format="multipart")
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["type"], "PHOTO")
        self.assertIsNotNone(data["thumbnail"], "thumbnail (400px) should not be None")
        self.assertIsNotNone(data["medium"], "medium (1000px) should not be None")

    def test_thumbnail_max_dimension_400(self):
        """The saved thumbnail must be ≤400px on any side."""
        f = make_jpeg(1600, 1200)
        res = self.client.post(self.url, {"file": f}, format="multipart")
        self.assertEqual(res.status_code, 201)
        media = HostelMedia.objects.get(id=res.json()["id"])
        with Image.open(media.thumbnail) as thumb:
            self.assertLessEqual(max(thumb.size), 400)

    def test_small_photo_not_upscaled(self):
        """An image smaller than 400px should not be upscaled by Pillow thumbnail."""
        f = make_jpeg(100, 100)
        res = self.client.post(self.url, {"file": f}, format="multipart")
        self.assertEqual(res.status_code, 201)
        media = HostelMedia.objects.get(id=res.json()["id"])
        with Image.open(media.thumbnail) as thumb:
            self.assertLessEqual(max(thumb.size), 100)

    def test_video_upload_has_no_thumbnail(self):
        """Videos should store the file but have None thumbnail/medium."""
        mp4 = SimpleUploadedFile("clip.mp4", b"\x00\x00\x00\x18ftyp", content_type="video/mp4")
        res = self.client.post(self.url, {"file": mp4}, format="multipart")
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["type"], "VIDEO")
        self.assertIsNone(data["thumbnail"])
        self.assertIsNone(data["medium"])


class TestDisplayOrderAndReorder(TestCase):
    def setUp(self):
        self.admin = make_admin("+233244010003")
        self.hostel = create_hostel(self.admin)
        self.client = auth_client(self.admin)
        self.url = f"/api/v1/admin/hostels/{self.hostel.id}/media/"

    def _upload(self) -> dict:
        f = make_jpeg()
        res = self.client.post(self.url, {"file": f}, format="multipart")
        self.assertEqual(res.status_code, 201)
        return res.json()

    def test_display_order_increments(self):
        """Each new upload should get display_order = previous + 1."""
        m1 = self._upload()
        m2 = self._upload()
        m3 = self._upload()
        self.assertEqual(m1["display_order"], 0)
        self.assertEqual(m2["display_order"], 1)
        self.assertEqual(m3["display_order"], 2)

    def test_reorder_persists(self):
        """PATCH /media/reorder/ should update display_order for each media item."""
        m1 = self._upload()
        m2 = self._upload()
        m3 = self._upload()

        # Reverse the order
        new_order = [m3["id"], m2["id"], m1["id"]]
        res = self.client.patch(
            f"/api/v1/admin/hostels/{self.hostel.id}/media/reorder/",
            {"order": new_order},
            format="json",
        )
        self.assertEqual(res.status_code, 200)

        updated = HostelMedia.objects.get(id=m3["id"])
        self.assertEqual(updated.display_order, 0)
        updated = HostelMedia.objects.get(id=m1["id"])
        self.assertEqual(updated.display_order, 2)


class TestMediaDelete(TestCase):
    def setUp(self):
        self.admin = make_admin("+233244010004")
        self.hostel = create_hostel(self.admin)
        self.client = auth_client(self.admin)

    def test_delete_removes_record(self):
        """DELETE /media/{id}/ should remove the DB record."""
        f = make_jpeg()
        res = self.client.post(
            f"/api/v1/admin/hostels/{self.hostel.id}/media/",
            {"file": f}, format="multipart",
        )
        media_id = res.json()["id"]

        del_res = self.client.delete(
            f"/api/v1/admin/hostels/{self.hostel.id}/media/{media_id}/"
        )
        self.assertEqual(del_res.status_code, 204)
        self.assertFalse(HostelMedia.objects.filter(id=media_id).exists())
