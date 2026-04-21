import uuid
from django.db import models
from django.conf import settings
from django.utils.text import slugify


class GenderPolicy(models.TextChoices):
    MALE = "MALE", "Male Only"
    FEMALE = "FEMALE", "Female Only"
    MIXED = "MIXED", "Mixed"


class HostelStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PENDING = "PENDING", "Pending Approval"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"
    SUSPENDED = "SUSPENDED", "Suspended"


class Amenity(models.Model):
    name = models.CharField(max_length=100, unique=True)
    icon = models.CharField(max_length=50, blank=True, help_text="Lucide icon name or similar class name")

    class Meta:
        verbose_name_plural = "Amenities"

    def __str__(self):
        return self.name


class Hostel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="hostels"
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    description = models.TextField()
    
    address_text = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    gender_policy = models.CharField(
        max_length=10, 
        choices=GenderPolicy.choices, 
        default=GenderPolicy.MIXED
    )
    
    owner_contact_phone = models.CharField(max_length=20)
    owner_contact_whatsapp = models.CharField(max_length=20, blank=True, null=True)
    
    status = models.CharField(
        max_length=20, 
        choices=HostelStatus.choices, 
        default=HostelStatus.DRAFT
    )
    rejection_reason = models.TextField(blank=True, null=True)
    created_by_super_admin = models.BooleanField(default=False)
    
    amenities = models.ManyToManyField(Amenity, related_name="hostels", blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            # Generate a unique slug
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 1
            while Hostel.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class MediaType(models.TextChoices):
    PHOTO = "PHOTO", "Photo"
    VIDEO = "VIDEO", "Video"

class HostelMedia(models.Model):
    hostel = models.ForeignKey(Hostel, on_delete=models.CASCADE, related_name="media")
    type = models.CharField(max_length=10, choices=MediaType.choices)
    file = models.FileField(upload_to="hostels/media/")
    thumbnail = models.ImageField(upload_to="hostels/media/thumbs_400/", blank=True, null=True)
    medium = models.ImageField(upload_to="hostels/media/thumbs_1000/", blank=True, null=True)
    caption = models.CharField(max_length=255, blank=True, null=True)
    display_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['display_order', 'created_at']

    def __str__(self):
        return f"{self.type} for {self.hostel.name}"

class RoomVariant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hostel = models.ForeignKey(Hostel, on_delete=models.CASCADE, related_name="variants")
    name = models.CharField(max_length=150)
    description = models.TextField()
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    min_occupancy = models.PositiveSmallIntegerField(default=1)
    max_occupancy = models.PositiveSmallIntegerField()
    features = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.hostel.name}"

class RoomStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    PARTIALLY_BOOKED = "PARTIALLY_BOOKED", "Partially Booked"
    FULL = "FULL", "Full"
    UNAVAILABLE = "UNAVAILABLE", "Unavailable"

class Room(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    variant = models.ForeignKey(RoomVariant, on_delete=models.CASCADE, related_name="rooms")
    label = models.CharField(max_length=50)
    locked_k = models.PositiveSmallIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=RoomStatus.choices, default=RoomStatus.AVAILABLE)

    class Meta:
        unique_together = ('variant', 'label')

    def __str__(self):
        return f"{self.label} ({self.variant.name})"
