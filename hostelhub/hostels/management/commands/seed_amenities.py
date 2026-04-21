from django.core.management.base import BaseCommand
from hostels.models import Amenity
from django.db import transaction

AMENITIES = [
    {"name": "Wi-Fi", "icon": "wifi"},
    {"name": "Water Tank", "icon": "droplet"},
    {"name": "Generator", "icon": "zap"},
    {"name": "Kitchen", "icon": "utensils"},
    {"name": "Ensuite Bathroom", "icon": "bath"},
    {"name": "Study Desk", "icon": "book-open"},
    {"name": "Air Conditioning", "icon": "wind"},
    {"name": "Security Guard", "icon": "shield"},
    {"name": "CCTV", "icon": "video"},
    {"name": "Cleaning Service", "icon": "sparkles"},
    {"name": "Laundry", "icon": "shirt"},
    {"name": "Parking", "icon": "car"},
]

class Command(BaseCommand):
    help = "Seed the database with standard amenities."

    def handle(self, *args, **options):
        with transaction.atomic():
            for data in AMENITIES:
                amenity, created = Amenity.objects.get_or_create(
                    name=data["name"],
                    defaults={"icon": data["icon"]}
                )
                if created:
                    self.stdout.write(self.style.SUCCESS(f"[+] Created Amenity: {amenity.name}"))
                else:
                    self.stdout.write(f"[SKIP] Amenity {amenity.name} already exists.")

        self.stdout.write(self.style.SUCCESS("\n[OK] Amenities seeded successfully!\n"))
