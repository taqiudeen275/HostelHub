"""Notification URL configuration."""
from django.urls import path

from .views import (
    SMSBroadcastLogView,
    SMSBroadcastPreviewView,
    SMSBroadcastView,
)


urlpatterns = [
    path(
        "admin/hostels/<uuid:hostel_id>/sms-broadcast/preview/",
        SMSBroadcastPreviewView.as_view(),
        name="sms-broadcast-preview",
    ),
    path(
        "admin/hostels/<uuid:hostel_id>/sms-broadcast/",
        SMSBroadcastView.as_view(),
        name="sms-broadcast",
    ),
    path(
        "admin/hostels/<uuid:hostel_id>/sms-log/",
        SMSBroadcastLogView.as_view(),
        name="sms-broadcast-log",
    ),
]
