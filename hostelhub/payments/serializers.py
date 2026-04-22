"""Payment serializers."""
from rest_framework import serializers

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    booking_id = serializers.UUIDField(source="booking.id", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "booking_id",
            "paystack_reference",
            "amount",
            "currency",
            "channel",
            "status",
            "verified_at",
            "refunded_at",
            "refund_reason",
            "created_at",
        ]
        read_only_fields = fields


class RefundRequestSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=5, max_length=500)
    amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True
    )
