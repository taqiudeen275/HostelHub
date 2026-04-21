"""
GAP-M2-02 / GAP-M2-08 — Hostel CRUD tests:
    - Cross-tenant isolation (Admin A cannot touch Admin B's hostel)
    - Hostel creation sets DRAFT status
    - FR-2.5: editing core fields on APPROVED hostel re-enters PENDING
    - FR-2.5: editing non-core fields on APPROVED hostel stays APPROVED
"""
import pytest
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from hostels.models import Hostel, HostelStatus


def make_admin(phone: str) -> User:
    return User.objects.create_user(phone=phone, role='HOSTEL_ADMIN', first_name="Test")


def create_hostel(owner: User, name: str = "Test Hostel", status=HostelStatus.DRAFT) -> Hostel:
    return Hostel.objects.create(
        owner=owner,
        name=name,
        description="A test hostel",
        address_text="123 Test Street",
        owner_contact_phone="+233244000001",
        status=status,
    )


def auth_client(user: User) -> APIClient:
    from rest_framework_simplejwt.tokens import RefreshToken
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token)}")
    return client


class TestCrossTenantIsolation(TestCase):
    """GAP-M2-02: Admin A must not access Admin B's hostel."""

    def setUp(self):
        self.admin_a = make_admin("+233244001001")
        self.admin_b = make_admin("+233244001002")
        self.hostel_b = create_hostel(self.admin_b, "B Hostel")
        self.client_a = auth_client(self.admin_a)

    def test_cannot_retrieve_other_admin_hostel(self):
        """GET /admin/hostels/{id}/ returns 404 for a hostel owned by another admin."""
        res = self.client_a.get(f"/api/v1/admin/hostels/{self.hostel_b.id}/")
        self.assertEqual(res.status_code, 404)

    def test_cannot_patch_other_admin_hostel(self):
        """PATCH /admin/hostels/{id}/ returns 404 for a hostel owned by another admin."""
        res = self.client_a.patch(
            f"/api/v1/admin/hostels/{self.hostel_b.id}/",
            {"name": "Hacked Name"},
            format="json",
        )
        self.assertEqual(res.status_code, 404)

    def test_cannot_delete_other_admin_hostel(self):
        """DELETE /admin/hostels/{id}/ returns 404 for a hostel owned by another admin."""
        res = self.client_a.delete(f"/api/v1/admin/hostels/{self.hostel_b.id}/")
        self.assertEqual(res.status_code, 404)

    def test_cannot_upload_media_to_other_hostel(self):
        """POST /admin/hostels/{id}/media/ returns 404 for a hostel owned by another admin."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        from PIL import Image
        import io
        img = Image.new("RGB", (100, 100), color=(200, 100, 50))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)
        f = SimpleUploadedFile("test.jpg", buf.read(), content_type="image/jpeg")
        res = self.client_a.post(
            f"/api/v1/admin/hostels/{self.hostel_b.id}/media/",
            {"file": f},
            format="multipart",
        )
        self.assertEqual(res.status_code, 404)

    def test_list_only_returns_own_hostels(self):
        """GET /admin/hostels/ does NOT include Admin B's hostel for Admin A."""
        create_hostel(self.admin_a, "A Hostel")
        res = self.client_a.get("/api/v1/admin/hostels/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # Handle both paginated ({results: [...]}) and plain list ([...]) responses
        items = data.get("results", data) if isinstance(data, dict) else data
        ids = [h["id"] for h in items]
        self.assertNotIn(str(self.hostel_b.id), ids)


class TestHostelCreationStatus(TestCase):
    """Hostel creation should start as DRAFT (for the photo upload gate — GAP-M2-11)."""

    def setUp(self):
        self.admin = make_admin("+233244002001")
        self.client = auth_client(self.admin)

    def test_create_hostel_starts_as_draft(self):
        res = self.client.post(
            "/api/v1/admin/hostels/",
            {
                "name": "Draft Hostel",
                "description": "A brand new hostel",
                "address_text": "1 Test Rd",
                "gender_policy": "MIXED",
                "owner_contact_phone": "+233244000099",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["status"], "DRAFT")


class TestRePendingLogic(TestCase):
    """GAP-M2-08 / FR-2.5: Editing core fields of an APPROVED hostel re-enters PENDING."""

    def setUp(self):
        self.admin = make_admin("+233244003001")
        self.hostel = create_hostel(self.admin, status=HostelStatus.APPROVED)
        self.client = auth_client(self.admin)

    def test_editing_name_re_triggers_pending(self):
        res = self.client.patch(
            f"/api/v1/admin/hostels/{self.hostel.id}/",
            {"name": "Changed Name"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.hostel.refresh_from_db()
        self.assertEqual(self.hostel.status, HostelStatus.PENDING)

    def test_editing_address_re_triggers_pending(self):
        res = self.client.patch(
            f"/api/v1/admin/hostels/{self.hostel.id}/",
            {"address_text": "999 New Street"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.hostel.refresh_from_db()
        self.assertEqual(self.hostel.status, HostelStatus.PENDING)

    def test_editing_description_does_not_re_trigger_pending(self):
        """Description is not a core field — APPROVED stays APPROVED."""
        res = self.client.patch(
            f"/api/v1/admin/hostels/{self.hostel.id}/",
            {"description": "Updated description only."},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.hostel.refresh_from_db()
        self.assertEqual(self.hostel.status, HostelStatus.APPROVED)

    def test_re_pending_only_on_approved(self):
        """Core field edits on a DRAFT hostel should NOT change its status."""
        draft = create_hostel(self.admin, "Draft Hostel", status=HostelStatus.DRAFT)
        res = self.client.patch(
            f"/api/v1/admin/hostels/{draft.id}/",
            {"name": "New Draft Name"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        draft.refresh_from_db()
        self.assertEqual(draft.status, HostelStatus.DRAFT)
