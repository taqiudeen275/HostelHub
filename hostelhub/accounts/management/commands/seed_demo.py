"""
Seed command: python manage.py seed_demo

Creates:
  - 1 Super Admin  (phone: +233200000001, email: admin@hostelhub.dev, password: AdminPass123!)
  - 2 Hostel Admins
  - 5 Students with full profiles and varied privacy settings

Safe to re-run — skips existing records.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import (
    User, UserRole,
    StudentProfile, StudentLevelChoices, PrivacyChoice,
    HostelAdminProfile,
)

# ─────────────────────────────────────────────
# Seed data definitions
# ─────────────────────────────────────────────

SUPER_ADMIN = {
    "phone": "+233200000001",
    "email": "admin@hostelhub.dev",
    "password": "AdminPass123!",
    "first_name": "Platform",
    "last_name": "Admin",
}

HOSTEL_ADMINS = [
    {
        "phone": "+233200000002",
        "first_name": "Kweku",
        "last_name": "Owusu",
        "business_name": "Owusu Hostels",
        "whatsapp_number": "+233200000002",
    },
    {
        "phone": "+233200000003",
        "first_name": "Akosua",
        "last_name": "Asante",
        "business_name": "Asante Premier Rooms",
        "whatsapp_number": "+233200000003",
    },
]

STUDENTS = [
    {
        "phone": "+233244100001",
        "first_name": "Ama",
        "last_name": "Mensah",
        "program": "Computer Science",
        "level": StudentLevelChoices.LEVEL_100,
        "gender": "Female",
        "privacy_phone": PrivacyChoice.ROOMMATES,
        "privacy_full_name": PrivacyChoice.ROOMMATES,
        "privacy_photo": PrivacyChoice.HOSTELMATES,
    },
    {
        "phone": "+233244100002",
        "first_name": "Kwame",
        "last_name": "Boateng",
        "program": "Electrical Engineering",
        "level": StudentLevelChoices.LEVEL_300,
        "gender": "Male",
        "privacy_phone": PrivacyChoice.NOBODY,
        "privacy_full_name": PrivacyChoice.ROOMMATES,
        "privacy_photo": PrivacyChoice.NOBODY,
    },
    {
        "phone": "+233244100003",
        "first_name": "Abena",
        "last_name": "Frimpong",
        "program": "Business Administration",
        "level": StudentLevelChoices.LEVEL_200,
        "gender": "Female",
        "privacy_phone": PrivacyChoice.HOSTELMATES,
        "privacy_full_name": PrivacyChoice.HOSTELMATES,
        "privacy_photo": PrivacyChoice.HOSTELMATES,
    },
    {
        "phone": "+233244100004",
        "first_name": "Kofi",
        "last_name": "Ansah",
        "program": "Medicine",
        "level": StudentLevelChoices.LEVEL_400,
        "gender": "Male",
        "privacy_phone": PrivacyChoice.ROOMMATES,
        "privacy_full_name": PrivacyChoice.HOSTELMATES,
        "privacy_photo": PrivacyChoice.ROOMMATES,
    },
    {
        "phone": "+233244100005",
        "first_name": "Efua",
        "last_name": "Darko",
        "program": "Law",
        "level": StudentLevelChoices.MASTERS,
        "gender": "Female",
        "privacy_phone": PrivacyChoice.NOBODY,
        "privacy_full_name": PrivacyChoice.NOBODY,
        "privacy_photo": PrivacyChoice.NOBODY,
    },
]


class Command(BaseCommand):
    help = "Seed the database with demo data for development and demonstration."

    def handle(self, *args, **options):
        with transaction.atomic():
            self._seed_super_admin()
            self._seed_hostel_admins()
            self._seed_students()

        self.stdout.write(self.style.SUCCESS("\n[OK] Demo data seeded successfully!\n"))
        self.stdout.write("-" * 50)
        self.stdout.write(f"  Super Admin:")
        self.stdout.write(f"    Phone   : {SUPER_ADMIN['phone']}")
        self.stdout.write(f"    Email   : {SUPER_ADMIN['email']}")
        self.stdout.write(f"    Password: {SUPER_ADMIN['password']}")
        self.stdout.write(f"    URL     : http://localhost:8000/django-admin/")
        self.stdout.write("-" * 50)
        self.stdout.write(f"  Hostel Admin phones  : {', '.join(a['phone'] for a in HOSTEL_ADMINS)}")
        self.stdout.write(f"  Student phones       : {', '.join(s['phone'] for s in STUDENTS)}")
        self.stdout.write("-" * 50)
        self.stdout.write("  All accounts use phone+OTP auth (no passwords for students/admins).")
        self.stdout.write("  Use SMS_BACKEND=console and check runserver output for OTP codes.\n")

    def _seed_super_admin(self):
        phone = SUPER_ADMIN["phone"]
        if User.objects.filter(phone=phone).exists():
            self.stdout.write(f"  [SKIP] Super Admin {phone} already exists.")
            return

        User.objects.create_superuser(
            phone=phone,
            password=SUPER_ADMIN["password"],
            email=SUPER_ADMIN["email"],
            first_name=SUPER_ADMIN["first_name"],
            last_name=SUPER_ADMIN["last_name"],
        )
        self.stdout.write(self.style.SUCCESS(f"  [+] Created Super Admin: {phone}"))

    def _seed_hostel_admins(self):
        for data in HOSTEL_ADMINS:
            phone = data["phone"]
            if User.objects.filter(phone=phone).exists():
                self.stdout.write(f"  [SKIP] Hostel Admin {phone} already exists.")
                continue

            user = User.objects.create_user(
                phone=phone,
                role=UserRole.HOSTEL_ADMIN,
                first_name=data["first_name"],
                last_name=data["last_name"],
            )
            user.is_verified = True
            user.save()

            HostelAdminProfile.objects.create(
                user=user,
                business_name=data["business_name"],
                whatsapp_number=data["whatsapp_number"],
            )
            self.stdout.write(self.style.SUCCESS(f"  [+] Created Hostel Admin: {phone} ({data['first_name']})"))

    def _seed_students(self):
        for data in STUDENTS:
            phone = data["phone"]
            if User.objects.filter(phone=phone).exists():
                self.stdout.write(f"  [SKIP] Student {phone} already exists.")
                continue

            user = User.objects.create_user(
                phone=phone,
                role=UserRole.STUDENT,
                first_name=data["first_name"],
                last_name=data["last_name"],
            )
            user.is_verified = True
            user.save()

            StudentProfile.objects.create(
                user=user,
                program=data["program"],
                level=data["level"],
                gender=data["gender"],
                privacy_phone=data["privacy_phone"],
                privacy_full_name=data["privacy_full_name"],
                privacy_photo=data["privacy_photo"],
            )
            self.stdout.write(self.style.SUCCESS(f"  [+] Created Student: {phone} ({data['first_name']})"))
