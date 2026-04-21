"""
M3 Week 8 tests — Public Browsing (FR-5).

Requirements (TIMELINE.md W8):
- Only APPROVED hostels appear in GET /hostels/.
- Gender-policy filter works.
- Search filter works.
- Pagination: response has count/next/previous/results keys.
- Slug-based detail endpoint returns the correct hostel.
"""
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from hostels.models import Hostel, HostelStatus, Amenity, RoomVariant


# ─── Helpers ──────────────────────────────────────────────────────────────────

def make_user(phone: str, role: str = "HOSTEL_ADMIN") -> User:
    return User.objects.create_user(phone=phone, role=role)


def make_hostel(owner: User, name: str, status: str = HostelStatus.APPROVED,
                gender: str = "MIXED", slug: str = "") -> Hostel:
    h = Hostel.objects.create(
        owner=owner,
        name=name,
        address_text="Test Address",
        owner_contact_phone="+233244000001",
        gender_policy=gender,
        status=status,
    )
    # Force a deterministic slug for tests
    if slug:
        h.slug = slug
        h.save(update_fields=["slug"])
    return h


# ─── Tests ────────────────────────────────────────────────────────────────────

class TestPublicListApprovalFilter(TestCase):
    """GET /hostels/ must return only APPROVED hostels regardless of auth."""

    BASE_URL = "/api/v1/hostels/"

    def setUp(self):
        owner = make_user("+233600000001")
        self.approved = make_hostel(owner, "Approved Hostel", HostelStatus.APPROVED)
        self.pending  = make_hostel(owner, "Pending Hostel",  HostelStatus.PENDING)
        self.draft    = make_hostel(owner, "Draft Hostel",    HostelStatus.DRAFT)
        self.rejected = make_hostel(owner, "Rejected Hostel", HostelStatus.REJECTED)
        self.client = APIClient()

    def _ids(self, res) -> set:
        data = res.json()
        results = data.get("results", data)
        return {str(h["id"]) for h in results}

    def test_anonymous_sees_only_approved(self):
        res = self.client.get(self.BASE_URL)
        self.assertEqual(res.status_code, 200, res.json())
        ids = self._ids(res)
        self.assertIn(str(self.approved.id), ids)
        self.assertNotIn(str(self.pending.id), ids)
        self.assertNotIn(str(self.draft.id), ids)
        self.assertNotIn(str(self.rejected.id), ids)

    def test_pagination_structure(self):
        """Response must have count, next, previous, results keys."""
        res = self.client.get(self.BASE_URL)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # DRF pagination wraps the list
        self.assertIn("count", data)
        self.assertIn("results", data)
        self.assertIn("next", data)
        self.assertIn("previous", data)


class TestGenderPolicyFilter(TestCase):
    """?gender_policy= filter only returns matching hostels."""

    BASE_URL = "/api/v1/hostels/"

    def setUp(self):
        owner = make_user("+233600000002")
        self.male   = make_hostel(owner, "Male Hostel",   HostelStatus.APPROVED, "MALE")
        self.female = make_hostel(owner, "Female Hostel", HostelStatus.APPROVED, "FEMALE")
        self.mixed  = make_hostel(owner, "Mixed Hostel",  HostelStatus.APPROVED, "MIXED")
        self.client = APIClient()

    def _ids(self, res) -> set:
        data = res.json()
        results = data.get("results", data)
        return {str(h["id"]) for h in results}

    def test_male_filter_excludes_female_and_mixed(self):
        res = self.client.get(self.BASE_URL + "?gender_policy=MALE")
        self.assertEqual(res.status_code, 200)
        ids = self._ids(res)
        self.assertIn(str(self.male.id), ids)
        self.assertNotIn(str(self.female.id), ids)
        self.assertNotIn(str(self.mixed.id), ids)

    def test_female_filter_excludes_male_and_mixed(self):
        res = self.client.get(self.BASE_URL + "?gender_policy=FEMALE")
        ids = self._ids(res)
        self.assertIn(str(self.female.id), ids)
        self.assertNotIn(str(self.male.id), ids)

    def test_no_filter_returns_all_approved(self):
        res = self.client.get(self.BASE_URL)
        ids = self._ids(res)
        self.assertIn(str(self.male.id), ids)
        self.assertIn(str(self.female.id), ids)
        self.assertIn(str(self.mixed.id), ids)


class TestSearchFilter(TestCase):
    """?search= matches hostel name or address."""

    BASE_URL = "/api/v1/hostels/"

    def setUp(self):
        owner = make_user("+233600000003")
        self.h1 = Hostel.objects.create(
            owner=owner, name="Kwame's Palace", address_text="Near KNUST Gate",
            owner_contact_phone="+233244000001", status=HostelStatus.APPROVED,
        )
        self.h2 = Hostel.objects.create(
            owner=owner, name="Student Inn", address_text="Legon Campus",
            owner_contact_phone="+233244000002", status=HostelStatus.APPROVED,
        )
        self.client = APIClient()

    def _ids(self, res) -> set:
        data = res.json()
        return {str(h["id"]) for h in data.get("results", data)}

    def test_search_by_name(self):
        res = self.client.get(self.BASE_URL + "?search=Kwame")
        self.assertEqual(res.status_code, 200)
        ids = self._ids(res)
        self.assertIn(str(self.h1.id), ids)
        self.assertNotIn(str(self.h2.id), ids)

    def test_search_by_address(self):
        res = self.client.get(self.BASE_URL + "?search=KNUST")
        ids = self._ids(res)
        self.assertIn(str(self.h1.id), ids)
        self.assertNotIn(str(self.h2.id), ids)

    def test_search_no_match_returns_empty(self):
        res = self.client.get(self.BASE_URL + "?search=ZZZNOMATCH")
        data = res.json()
        results = data.get("results", data)
        self.assertEqual(len(results), 0)


class TestSlugDetailEndpoint(TestCase):
    """GET /hostels/{slug}/ returns the correct APPROVED hostel."""

    def setUp(self):
        self.owner = make_user("+233600000004")
        self.hostel = make_hostel(self.owner, "Slug Test Hostel", HostelStatus.APPROVED, slug="slug-test-hostel")
        self.client = APIClient()

    def test_detail_by_slug_returns_200(self):
        res = self.client.get(f"/api/v1/hostels/{self.hostel.slug}/")
        self.assertEqual(res.status_code, 200, res.json())
        self.assertEqual(res.json()["name"], "Slug Test Hostel")

    def test_pending_hostel_slug_returns_404(self):
        pending = make_hostel(self.owner, "Hidden Hostel", HostelStatus.PENDING, slug="hidden-hostel")
        res = self.client.get(f"/api/v1/hostels/{pending.slug}/")
        self.assertEqual(res.status_code, 404)


class TestPriceRangeFilter(TestCase):
    """?min_price= / ?max_price= filter by variant total_price."""

    BASE_URL = "/api/v1/hostels/"

    def setUp(self):
        self.owner = make_user("+233600000005")
        self.cheap = make_hostel(self.owner, "Cheap Hostel", HostelStatus.APPROVED)
        RoomVariant.objects.create(
            hostel=self.cheap, name="Basic", total_price=500, min_occupancy=1, max_occupancy=2
        )
        self.expensive = make_hostel(self.owner, "Expensive Hostel", HostelStatus.APPROVED)
        RoomVariant.objects.create(
            hostel=self.expensive, name="Deluxe", total_price=3000, min_occupancy=1, max_occupancy=1
        )
        self.client = APIClient()

    def _ids(self, res) -> set:
        data = res.json()
        return {str(h["id"]) for h in data.get("results", data)}

    def test_max_price_excludes_expensive(self):
        res = self.client.get(self.BASE_URL + "?max_price=1000")
        self.assertEqual(res.status_code, 200)
        ids = self._ids(res)
        self.assertIn(str(self.cheap.id), ids)
        self.assertNotIn(str(self.expensive.id), ids)

    def test_min_price_excludes_cheap(self):
        res = self.client.get(self.BASE_URL + "?min_price=2000")
        ids = self._ids(res)
        self.assertIn(str(self.expensive.id), ids)
        self.assertNotIn(str(self.cheap.id), ids)


class TestAmenityFilter(TestCase):
    """?amenities= filters hostels by amenity ID."""

    BASE_URL = "/api/v1/hostels/"

    def setUp(self):
        self.owner = make_user("+233600000006")
        self.wifi = Amenity.objects.create(name="Wi-Fi")
        self.gen  = Amenity.objects.create(name="Generator")

        self.with_wifi = make_hostel(self.owner, "WiFi Hostel", HostelStatus.APPROVED)
        self.with_wifi.amenities.add(self.wifi)

        self.no_wifi = make_hostel(self.owner, "No WiFi Hostel", HostelStatus.APPROVED)
        self.no_wifi.amenities.add(self.gen)

        self.client = APIClient()

    def _ids(self, res) -> set:
        data = res.json()
        return {str(h["id"]) for h in data.get("results", data)}

    def test_amenity_filter_returns_only_matching(self):
        res = self.client.get(self.BASE_URL + f"?amenities={self.wifi.id}")
        self.assertEqual(res.status_code, 200)
        ids = self._ids(res)
        self.assertIn(str(self.with_wifi.id), ids)
        self.assertNotIn(str(self.no_wifi.id), ids)
