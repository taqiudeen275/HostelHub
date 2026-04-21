"""
M3 Week 7 tests — Super Admin Approval flow.

Requirements (TIMELINE.md W7):
- Only Super Admin can approve/reject (Hostel Admin → 403).
- On-behalf-created hostels are auto-APPROVED and created_by_super_admin=True.
- AuditLog records all sensitive actions (approve, reject, create_on_behalf).
"""
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from hostels.models import Hostel, HostelStatus, Amenity
from core.models import AuditLog, ActionType


# ─── Helpers ──────────────────────────────────────────────────────────────────

def make_user(phone: str, role: str, name: str = "") -> User:
    u = User.objects.create_user(phone=phone, role=role)
    return u


def authed_client(user: User) -> APIClient:
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(user)
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return c


def make_pending_hostel(owner: User, name: str = "Test Hostel") -> Hostel:
    return Hostel.objects.create(
        owner=owner,
        name=name,
        address_text="Near Campus",
        owner_contact_phone="+233244000001",
        status=HostelStatus.PENDING,
    )


# ─── Tests ────────────────────────────────────────────────────────────────────

class TestSuperAdminPermissions(TestCase):
    """Only users with role=SUPER_ADMIN can call approve/reject."""

    def setUp(self):
        self.super_admin = make_user("+233200000001", "SUPER_ADMIN")
        self.hostel_admin = make_user("+233200000002", "HOSTEL_ADMIN")
        self.student = make_user("+233200000003", "STUDENT")
        self.owner = make_user("+233200000004", "HOSTEL_ADMIN")
        self.hostel = make_pending_hostel(self.owner)

    def test_super_admin_can_approve(self):
        """SUPER_ADMIN → POST /superadmin/hostels/{id}/approve/ returns 200."""
        client = authed_client(self.super_admin)
        res = client.post(f"/api/v1/superadmin/hostels/{self.hostel.id}/approve/")
        self.assertEqual(res.status_code, 200, res.json())
        self.hostel.refresh_from_db()
        self.assertEqual(self.hostel.status, HostelStatus.APPROVED)

    def test_hostel_admin_cannot_approve(self):
        """HOSTEL_ADMIN → POST /superadmin/hostels/{id}/approve/ returns 403."""
        client = authed_client(self.hostel_admin)
        res = client.post(f"/api/v1/superadmin/hostels/{self.hostel.id}/approve/")
        self.assertIn(res.status_code, [403, 404])

    def test_student_cannot_approve(self):
        """STUDENT → POST /superadmin/hostels/{id}/approve/ returns 403."""
        client = authed_client(self.student)
        res = client.post(f"/api/v1/superadmin/hostels/{self.hostel.id}/approve/")
        self.assertIn(res.status_code, [403, 404])

    def test_anonymous_cannot_approve(self):
        """Unauthenticated request → 401."""
        client = APIClient()
        res = client.post(f"/api/v1/superadmin/hostels/{self.hostel.id}/approve/")
        self.assertEqual(res.status_code, 401)

    def test_super_admin_can_reject(self):
        """SUPER_ADMIN → POST /superadmin/hostels/{id}/reject/ returns 200."""
        client = authed_client(self.super_admin)
        res = client.post(
            f"/api/v1/superadmin/hostels/{self.hostel.id}/reject/",
            {"reason": "Blurry photos"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.json())
        self.hostel.refresh_from_db()
        self.assertEqual(self.hostel.status, HostelStatus.REJECTED)
        self.assertEqual(self.hostel.rejection_reason, "Blurry photos")

    def test_reject_requires_reason(self):
        """Reject without a reason → 400."""
        client = authed_client(self.super_admin)
        res = client.post(
            f"/api/v1/superadmin/hostels/{self.hostel.id}/reject/",
            {},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_cannot_approve_already_approved_hostel(self):
        """Approving an already-APPROVED hostel is rejected.

        The viewset's queryset is scoped to PENDING by default, so an APPROVED
        hostel won't be found (→ 404).  A more direct path returns 400.  Both are
        valid — the end result is that the hostel is not re-approved.
        """
        self.hostel.status = HostelStatus.APPROVED
        self.hostel.save()
        client = authed_client(self.super_admin)
        res = client.post(f"/api/v1/superadmin/hostels/{self.hostel.id}/approve/")
        # 404: not in the PENDING queryset; 400: guard in the action itself
        self.assertIn(res.status_code, [400, 404])


class TestAuditLogRecording(TestCase):
    """AuditLog is written on every sensitive super admin action."""

    def setUp(self):
        self.super_admin = make_user("+233300000001", "SUPER_ADMIN")
        self.owner = make_user("+233300000002", "HOSTEL_ADMIN")
        self.hostel = make_pending_hostel(self.owner, "Audit Hostel")
        self.client = authed_client(self.super_admin)

    def test_approve_creates_audit_log(self):
        self.client.post(f"/api/v1/superadmin/hostels/{self.hostel.id}/approve/")
        log = AuditLog.objects.filter(
            actor=self.super_admin,
            action=ActionType.APPROVE,
            target_object_id=str(self.hostel.id),
        ).first()
        self.assertIsNotNone(log, "AuditLog record should exist after approve")
        self.assertEqual(log.actor, self.super_admin)

    def test_reject_creates_audit_log(self):
        self.client.post(
            f"/api/v1/superadmin/hostels/{self.hostel.id}/reject/",
            {"reason": "Low quality"},
            format="json",
        )
        log = AuditLog.objects.filter(
            actor=self.super_admin,
            action=ActionType.REJECT,
            target_object_id=str(self.hostel.id),
        ).first()
        self.assertIsNotNone(log, "AuditLog record should exist after reject")
        self.assertIn("Low quality", log.notes)

    def test_create_on_behalf_creates_audit_log(self):
        res = self.client.post(
            "/api/v1/superadmin/hostels/create-on-behalf/",
            {"phone": "+233400000099", "name": "On Behalf Hostel", "owner_contact_phone": "+233400000099"},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.json())
        log = AuditLog.objects.filter(
            actor=self.super_admin,
            action=ActionType.CREATE_ON_BEHALF,
        ).first()
        self.assertIsNotNone(log, "AuditLog record should exist after create_on_behalf")


class TestCreateOnBehalf(TestCase):
    """On-behalf hostel creation (PRD §8.6)."""

    def setUp(self):
        self.super_admin = make_user("+233500000001", "SUPER_ADMIN")
        self.client = authed_client(self.super_admin)

    def test_on_behalf_hostel_is_auto_approved(self):
        """Hostel created on behalf should start as APPROVED (not PENDING)."""
        res = self.client.post(
            "/api/v1/superadmin/hostels/create-on-behalf/",
            {
                "phone": "+233500000099",
                "name": "Kwame's Hostel",
                "owner_contact_phone": "+233500000099",
                "address_text": "Near Legon",
                "gender_policy": "MIXED",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.json())
        hostel_id = res.json()["id"]
        hostel = Hostel.objects.get(id=hostel_id)
        self.assertEqual(hostel.status, HostelStatus.APPROVED)
        self.assertTrue(hostel.created_by_super_admin)

    def test_on_behalf_creates_hostel_admin_account(self):
        """If the phone is new, a HOSTEL_ADMIN account should be created."""
        NEW_PHONE = "+233500000098"
        self.assertFalse(User.objects.filter(phone=NEW_PHONE).exists())
        res = self.client.post(
            "/api/v1/superadmin/hostels/create-on-behalf/",
            {"phone": NEW_PHONE, "name": "New Admin Hostel", "owner_contact_phone": NEW_PHONE},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.json())
        self.assertTrue(User.objects.filter(phone=NEW_PHONE, role="HOSTEL_ADMIN").exists())

    def test_on_behalf_assigns_owner_to_existing_account(self):
        """If the phone already belongs to a HOSTEL_ADMIN, use that account."""
        existing = make_user("+233500000097", "HOSTEL_ADMIN")
        res = self.client.post(
            "/api/v1/superadmin/hostels/create-on-behalf/",
            {"phone": existing.phone, "name": "Existing Admin Hostel", "owner_contact_phone": existing.phone},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.json())
        hostel = Hostel.objects.get(id=res.json()["id"])
        self.assertEqual(hostel.owner, existing)

    def test_on_behalf_accepts_amenities(self):
        """Amenity IDs in request body should be set on the hostel."""
        a1 = Amenity.objects.create(name="Wi-Fi")
        a2 = Amenity.objects.create(name="Generator")
        res = self.client.post(
            "/api/v1/superadmin/hostels/create-on-behalf/",
            {
                "phone": "+233500000096",
                "name": "Amenity Hostel",
                "owner_contact_phone": "+233500000096",
                "amenity_ids": [a1.id, a2.id],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.json())
        hostel = Hostel.objects.get(id=res.json()["id"])
        self.assertIn(a1, hostel.amenities.all())
        self.assertIn(a2, hostel.amenities.all())

    def test_on_behalf_requires_phone_and_name(self):
        """Missing required fields → 400."""
        res = self.client.post(
            "/api/v1/superadmin/hostels/create-on-behalf/",
            {"name": "No Phone"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
