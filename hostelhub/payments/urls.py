"""Payment URL configuration (mounted at /api/v1/payments/)."""
from django.urls import path

from .views import PaymentDetailView, PaymentRefundView, PaystackWebhookView


urlpatterns = [
    path("paystack/webhook/", PaystackWebhookView.as_view(), name="paystack-webhook"),
    path("<uuid:pk>/", PaymentDetailView.as_view(), name="payment-detail"),
    path("<uuid:pk>/refund/", PaymentRefundView.as_view(), name="payment-refund"),
]
