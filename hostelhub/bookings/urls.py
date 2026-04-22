"""Booking URL configuration (mounted at /api/v1/bookings/)."""
from django.urls import path

from .views import (
    BookingCancelView,
    BookingCheckInView,
    BookingCheckOutView,
    BookingDetailView,
    BookingListCreateView,
)


urlpatterns = [
    path("", BookingListCreateView.as_view(), name="booking-list-create"),
    path("<uuid:pk>/", BookingDetailView.as_view(), name="booking-detail"),
    path("<uuid:pk>/cancel/", BookingCancelView.as_view(), name="booking-cancel"),
    path("<uuid:pk>/check-in/", BookingCheckInView.as_view(), name="booking-check-in"),
    path("<uuid:pk>/check-out/", BookingCheckOutView.as_view(), name="booking-check-out"),
]
