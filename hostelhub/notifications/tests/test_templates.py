"""Each transactional SMS template fires and logs an SMSMessage row."""
from datetime import date

import pytest

from notifications.models import SMSMessage
from notifications.services import (
    compute_segments,
    send_booking_confirmation_sms,
    send_check_in_reminder_sms,
    send_hostel_approval_sms,
    send_payment_received_sms,
)


pytestmark = pytest.mark.django_db


def test_booking_confirmation_logs_row():
    send_booking_confirmation_sms("+233244111111", "Unity", "R1")
    row = SMSMessage.objects.get(to_phone="+233244111111")
    assert row.template_key == "booking_confirmed"
    assert "Unity" in row.body
    assert "R1" in row.body
    assert row.status == "SENT"


def test_payment_received_logs_row():
    send_payment_received_sms("+233244222222", 1500, "HH-ABC")
    row = SMSMessage.objects.get(to_phone="+233244222222")
    assert row.template_key == "payment_received"
    assert "1500" in row.body
    assert "HH-ABC" in row.body


def test_hostel_approval_logs_approved():
    send_hostel_approval_sms("+233244333333", "Unity", approved=True)
    row = SMSMessage.objects.get(to_phone="+233244333333")
    assert row.template_key == "hostel_approved"
    assert "APPROVED" in row.body


def test_hostel_approval_logs_rejected():
    send_hostel_approval_sms("+233244444444", "Unity", approved=False, reason="Bad photos")
    row = SMSMessage.objects.get(to_phone="+233244444444")
    assert row.template_key == "hostel_rejected"
    assert "Bad photos" in row.body


def test_check_in_reminder_logs_row():
    send_check_in_reminder_sms("+233244555555", "Unity", "R1", date(2026, 9, 15))
    row = SMSMessage.objects.get(to_phone="+233244555555")
    assert row.template_key == "check_in_reminder"
    assert "Unity" in row.body


def test_compute_segments_boundaries():
    assert compute_segments("") == 0
    assert compute_segments("a" * 160) == 1
    assert compute_segments("a" * 161) == 2
    assert compute_segments("a" * 306) == 2
    assert compute_segments("a" * 307) == 3
    assert compute_segments("a" * 459) == 3
