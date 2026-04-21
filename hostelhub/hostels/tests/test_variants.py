"""
Week 6 variant and room tests (GAP-M2-13):
    - Variant validation: min_occupancy ≥ 1
    - Variant validation: max_occupancy ≥ min_occupancy
    - Variant validation: total_price > 0
    - Bulk room creation succeeds
    - Duplicate room labels rejected (400)
    - Variant rooms are scoped to their variant
    - Submit for review requires ≥3 photos + ≥1 variant (GAP-M2-11)
"""
import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User
from hostels.models import Hostel, HostelStatus, Room, RoomVariant


def make_admin(phone: str) -> User:
    return User.objects.create_user(phone=phone, role='HOSTEL_ADMIN', first_name="Tester")


def create_hostel(owner: User, status=HostelStatus.DRAFT) -> Hostel:
    return Hostel.objects.create(
        owner=owner,
        name="Variant Test Hostel",
        description="desc",
        address_text="1 St.",
        owner_contact_phone="+233244000001",
        status=status,
    )


def auth_client(user: User) -> APIClient:
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token)}")
    return client


def create_variant(hostel: Hostel, name: str = "Standard") -> RoomVariant:
    return RoomVariant.objects.create(
        hostel=hostel,
        name=name,
        description="Standard room",
        total_price="1200.00",
        min_occupancy=1,
        max_occupancy=2,
    )


def make_jpeg() -> SimpleUploadedFile:
    img = Image.new("RGB", (200, 200), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return SimpleUploadedFile("photo.jpg", buf.read(), content_type="image/jpeg")


class TestVariantValidation(TestCase):
    def setUp(self):
        self.admin = make_admin("+233244020001")
        self.hostel = create_hostel(self.admin)
        self.client = auth_client(self.admin)
        self.url = f"/api/v1/admin/hostels/{self.hostel.id}/variants/"

    def _post(self, data: dict) -> dict:
        return self.client.post(self.url, data, format="json")

    def test_min_occupancy_less_than_1_rejected(self):
        res = self._post({
            "name": "Bad Variant", "description": "test",
            "total_price": "1000", "min_occupancy": 0, "max_occupancy": 2
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("min_occupancy", res.json())

    def test_max_less_than_min_rejected(self):
        res = self._post({
            "name": "Bad Variant", "description": "test",
            "total_price": "1000", "min_occupancy": 3, "max_occupancy": 2
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("max_occupancy", res.json())

    def test_price_zero_rejected(self):
        res = self._post({
            "name": "Bad Variant", "description": "test",
            "total_price": "0", "min_occupancy": 1, "max_occupancy": 2
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("total_price", res.json())

    def test_negative_price_rejected(self):
        res = self._post({
            "name": "Bad Variant", "description": "test",
            "total_price": "-500", "min_occupancy": 1, "max_occupancy": 2
        })
        self.assertEqual(res.status_code, 400)

    def test_valid_variant_created(self):
        res = self._post({
            "name": "Deluxe", "description": "Deluxe room",
            "total_price": "1500", "min_occupancy": 1, "max_occupancy": 1
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["name"], "Deluxe")


class TestBulkRoomCreation(TestCase):
    def setUp(self):
        self.admin = make_admin("+233244020002")
        self.hostel = create_hostel(self.admin)
        self.variant = create_variant(self.hostel)
        self.client = auth_client(self.admin)
        self.url = f"/api/v1/admin/variants/{self.variant.id}/rooms/bulk/"

    def test_bulk_create_rooms_success(self):
        """Bulk create 5 rooms at once."""
        res = self.client.post(
            self.url,
            {"labels": ["R1", "R2", "R3", "R4", "R5"]},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Room.objects.filter(variant=self.variant).count(), 5)

    def test_duplicate_labels_rejected(self):
        """Attempting to create a room with an existing label should fail."""
        Room.objects.create(variant=self.variant, label="A1")
        res = self.client.post(self.url, {"labels": ["A1", "A2"]}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.json())

    def test_label_uniqueness_per_variant(self):
        """Same label is allowed in a different variant of the same hostel."""
        other_variant = create_variant(self.hostel, "Deluxe")
        Room.objects.create(variant=self.variant, label="101")
        res = self.client.post(
            f"/api/v1/admin/variants/{other_variant.id}/rooms/bulk/",
            {"labels": ["101"]},  # same label, different variant
            format="json",
        )
        self.assertEqual(res.status_code, 201)

    def test_empty_labels_rejected(self):
        """Sending empty labels list should return 400."""
        res = self.client.post(self.url, {"labels": []}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_bulk_create_13_rooms_two_variants(self):
        """The PRD §3.5 example: 5 rooms (Deluxe) + 8 rooms (Standard) = 13 total."""
        deluxe = create_variant(self.hostel, "Deluxe")
        standard = self.variant

        self.client.post(
            f"/api/v1/admin/variants/{deluxe.id}/rooms/bulk/",
            {"labels": [f"D{i}" for i in range(1, 6)]},  # D1–D5
            format="json",
        )
        self.client.post(
            f"/api/v1/admin/variants/{standard.id}/rooms/bulk/",
            {"labels": [f"S{i}" for i in range(1, 9)]},  # S1–S8
            format="json",
        )

        self.assertEqual(Room.objects.filter(variant=deluxe).count(), 5)
        self.assertEqual(Room.objects.filter(variant=standard).count(), 8)
        self.assertEqual(Room.objects.filter(variant__hostel=self.hostel).count(), 13)


class TestSubmitForReview(TestCase):
    """GAP-M2-11: Submit action enforces ≥3 photos + ≥1 variant."""

    def setUp(self):
        self.admin = make_admin("+233244020003")
        self.hostel = create_hostel(self.admin, status=HostelStatus.DRAFT)
        self.client = auth_client(self.admin)
        self.url = f"/api/v1/admin/hostels/{self.hostel.id}/submit/"

    def _upload_photo(self):
        f = make_jpeg()
        self.client.post(
            f"/api/v1/admin/hostels/{self.hostel.id}/media/",
            {"file": f}, format="multipart",
        )

    def test_submit_fails_without_photos(self):
        res = self.client.post(self.url)
        self.assertEqual(res.status_code, 400)
        self.assertIn("3 photos", res.json()["error"])

    def test_submit_fails_with_less_than_3_photos(self):
        self._upload_photo()
        self._upload_photo()
        res = self.client.post(self.url)
        self.assertEqual(res.status_code, 400)

    def test_submit_fails_without_variant(self):
        self._upload_photo()
        self._upload_photo()
        self._upload_photo()
        res = self.client.post(self.url)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Variant", res.json()["error"])

    def test_submit_succeeds_with_3_photos_and_1_variant(self):
        self._upload_photo()
        self._upload_photo()
        self._upload_photo()
        create_variant(self.hostel)
        res = self.client.post(self.url)
        self.assertEqual(res.status_code, 200)
        self.hostel.refresh_from_db()
        self.assertEqual(self.hostel.status, HostelStatus.PENDING)

    def test_cannot_submit_already_pending_hostel(self):
        self.hostel.status = HostelStatus.PENDING
        self.hostel.save()
        res = self.client.post(self.url)
        self.assertEqual(res.status_code, 400)

    def test_rejected_hostel_can_resubmit(self):
        self._upload_photo()
        self._upload_photo()
        self._upload_photo()
        create_variant(self.hostel)
        self.hostel.status = HostelStatus.REJECTED
        self.hostel.rejection_reason = "Bad photos"
        self.hostel.save()
        res = self.client.post(self.url)
        self.assertEqual(res.status_code, 200)
        self.hostel.refresh_from_db()
        self.assertEqual(self.hostel.status, HostelStatus.PENDING)
        self.assertIsNone(self.hostel.rejection_reason)
