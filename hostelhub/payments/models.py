"""Payment models. One Payment per Paystack transaction (see PRD §10.12, §11)."""
import uuid

from django.db import models


class PaymentStatus(models.TextChoices):
    INITIATED = "INITIATED", "Initiated"
    SUCCESS = "SUCCESS", "Success"
    FAILED = "FAILED", "Failed"
    REFUNDED = "REFUNDED", "Refunded"


class PaymentChannel(models.TextChoices):
    CARD = "card", "Card"
    MOBILE_MONEY = "mobile_money", "Mobile Money"
    BANK = "bank", "Bank Transfer"
    UNKNOWN = "unknown", "Unknown"


class Payment(models.Model):
    """
    Records a Paystack transaction attempt for a single Booking. Uniqueness is
    enforced on `paystack_reference` — the webhook handler deduplicates using it.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(
        "bookings.Booking",
        on_delete=models.PROTECT,
        related_name="payments",
    )
    paystack_reference = models.CharField(max_length=100, unique=True, db_index=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="GHS")
    channel = models.CharField(
        max_length=20,
        choices=PaymentChannel.choices,
        default=PaymentChannel.UNKNOWN,
        blank=True,
    )
    status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.INITIATED,
    )
    paystack_raw = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    # For refunds: super admin records a reason; audit log links back here.
    refund_reason = models.TextField(blank=True, default="")
    refunded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "payments_payment"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Payment({self.paystack_reference}, {self.status})"

    @property
    def amount_pesewas(self):
        """Paystack works in pesewas (smallest GHS unit). Multiply by 100."""
        return int(self.amount * 100)
