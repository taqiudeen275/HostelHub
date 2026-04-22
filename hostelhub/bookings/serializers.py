"""Booking serializers."""
from rest_framework import serializers

from .models import Booking, BookingStatus


class BookingCreateSerializer(serializers.Serializer):
    """
    Payload for POST /bookings/.
    The service layer handles deep validation (variant-approved, locked_k, etc.);
    this serializer just checks field shape.
    """
    room_id = serializers.UUIDField()
    chosen_occupancy = serializers.IntegerField(min_value=1)


class BookingCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)


class _HostelBrief(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    slug = serializers.CharField()
    address_text = serializers.CharField(allow_blank=True)
    latitude = serializers.DecimalField(max_digits=10, decimal_places=7, allow_null=True)
    longitude = serializers.DecimalField(max_digits=10, decimal_places=7, allow_null=True)
    owner_contact_phone = serializers.CharField(allow_blank=True)


class _VariantBrief(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    min_occupancy = serializers.IntegerField()
    max_occupancy = serializers.IntegerField()


class _RoomBrief(serializers.Serializer):
    id = serializers.UUIDField()
    label = serializers.CharField()
    locked_k = serializers.IntegerField(allow_null=True)
    status = serializers.CharField()


class _StudentBrief(serializers.Serializer):
    id = serializers.UUIDField()
    phone = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()


class _PaymentBrief(serializers.Serializer):
    id = serializers.UUIDField()
    paystack_reference = serializers.CharField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    status = serializers.CharField()
    channel = serializers.CharField(allow_blank=True)
    verified_at = serializers.DateTimeField(allow_null=True)


class BookingSerializer(serializers.ModelSerializer):
    """Read-only booking view used by GET /bookings/ and GET /bookings/{id}/."""
    hostel = serializers.SerializerMethodField()
    variant = serializers.SerializerMethodField()
    room = serializers.SerializerMethodField()
    student = serializers.SerializerMethodField()
    payments = serializers.SerializerMethodField()
    latest_payment = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id",
            "status",
            "chosen_occupancy_at_booking",
            "price_paid",
            "reservation_expires_at",
            "created_at",
            "updated_at",
            "student",
            "hostel",
            "variant",
            "room",
            "payments",
            "latest_payment",
        ]
        read_only_fields = fields

    def get_hostel(self, obj):
        h = obj.room.variant.hostel
        return _HostelBrief(
            {
                "id": h.id,
                "name": h.name,
                "slug": h.slug,
                "address_text": h.address_text or "",
                "latitude": h.latitude,
                "longitude": h.longitude,
                "owner_contact_phone": h.owner_contact_phone or "",
            }
        ).data

    def get_variant(self, obj):
        v = obj.room.variant
        return _VariantBrief(
            {
                "id": v.id,
                "name": v.name,
                "total_price": v.total_price,
                "min_occupancy": v.min_occupancy,
                "max_occupancy": v.max_occupancy,
            }
        ).data

    def get_room(self, obj):
        r = obj.room
        return _RoomBrief(
            {
                "id": r.id,
                "label": r.label,
                "locked_k": r.locked_k,
                "status": r.status,
            }
        ).data

    def get_student(self, obj):
        s = obj.student
        return _StudentBrief(
            {
                "id": s.id,
                "phone": s.phone,
                "first_name": s.first_name,
                "last_name": s.last_name,
            }
        ).data

    def get_payments(self, obj):
        return [
            _PaymentBrief(
                {
                    "id": p.id,
                    "paystack_reference": p.paystack_reference,
                    "amount": p.amount,
                    "status": p.status,
                    "channel": p.channel or "",
                    "verified_at": p.verified_at,
                }
            ).data
            for p in obj.payments.all().order_by("-created_at")
        ]

    def get_latest_payment(self, obj):
        p = obj.payments.order_by("-created_at").first()
        if not p:
            return None
        return _PaymentBrief(
            {
                "id": p.id,
                "paystack_reference": p.paystack_reference,
                "amount": p.amount,
                "status": p.status,
                "channel": p.channel or "",
                "verified_at": p.verified_at,
            }
        ).data


class BookingCreateResponseSerializer(serializers.Serializer):
    """Wraps the created booking + Paystack authorization URL."""
    booking = BookingSerializer()
    authorization_url = serializers.URLField()
    payment_reference = serializers.CharField()
