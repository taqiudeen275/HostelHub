from django.db import models
from django.conf import settings

class SMSMessage(models.Model):
    STATUS_CHOICES = [
        ("QUEUED", "Queued"),
        ("SENT", "Sent"),
        ("DELIVERED", "Delivered"),
        ("FAILED", "Failed"),
    ]
    ROLE_CHOICES = [
        ("SYSTEM", "System"),
        ("SUPER_ADMIN", "Super Admin"),
        ("HOSTEL_ADMIN", "Hostel Admin"),
    ]

    to_phone = models.CharField(max_length=20)
    from_role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="SYSTEM")
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="sent_sms"
    )
    body = models.TextField()
    template_key = models.CharField(max_length=50, null=True, blank=True)
    arkesel_message_id = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="QUEUED")
    cost = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"SMS to {self.to_phone} ({self.status})"
