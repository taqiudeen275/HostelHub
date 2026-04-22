"""Background tasks for bookings — scheduled via Django-Q2."""
import logging
from datetime import datetime, time, timedelta

from django.utils import timezone

from .models import Booking, BookingStatus
from .services import expire_stale_bookings


logger = logging.getLogger(__name__)


def expire_pending_bookings_task():
    """
    Runs every minute. Sweeps PENDING_PAYMENT bookings whose 15-min window has
    closed and releases their slots.
    """
    try:
        count = expire_stale_bookings()
        if count:
            logger.info("Expired %d stale PENDING_PAYMENT bookings.", count)
    except Exception:  # pragma: no cover
        logger.exception("expire_pending_bookings_task crashed")


def send_check_in_reminders_task():
    """
    Runs daily at 08:00 Africa/Accra. For every CONFIRMED / CHECKED_IN booking
    with `expected_check_in` = tomorrow, SMS the student a reminder — unless
    we've already logged one today (idempotent across same-day retries).
    """
    from notifications.models import SMSMessage
    from notifications.services import send_check_in_reminder_sms

    today = timezone.localdate()
    target_date = today + timedelta(days=1)

    bookings = (
        Booking.objects.filter(
            expected_check_in=target_date,
            status__in=(BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN),
        )
        .select_related("student", "room__variant__hostel")
    )

    # Phones that already got a reminder SMS logged today — dedup cheaply.
    already_today = set(
        SMSMessage.objects.filter(
            template_key="check_in_reminder",
            created_at__date=today,
        ).values_list("to_phone", flat=True)
    )

    sent = 0
    for booking in bookings:
        phone = booking.student.phone
        if phone in already_today:
            continue
        try:
            send_check_in_reminder_sms(
                phone=phone,
                hostel_name=booking.room.variant.hostel.name,
                room_label=booking.room.label,
                check_in_date=booking.expected_check_in,
            )
            already_today.add(phone)
            sent += 1
        except Exception:  # pragma: no cover
            logger.exception("check_in_reminder failed for booking %s", booking.id)
    if sent:
        logger.info("Sent %d check-in reminders for %s.", sent, target_date)
    return sent


def _next_8am_local_utc() -> datetime:
    """Return the next 08:00 Africa/Accra instant, expressed as a UTC datetime."""
    now = timezone.localtime()
    today_8 = timezone.make_aware(datetime.combine(now.date(), time(8, 0)))
    next_run_local = today_8 if now < today_8 else today_8 + timedelta(days=1)
    return next_run_local.astimezone(timezone.utc)


def register_schedule():
    """
    Idempotently register every bookings schedule. Called from AppConfig.ready()
    via the post_migrate signal. Safe to call multiple times.
    """
    try:
        from django_q.models import Schedule
    except Exception:
        return  # Django-Q not ready during migrations etc.

    Schedule.objects.update_or_create(
        name="bookings.expire_pending",
        defaults={
            "func": "bookings.tasks.expire_pending_bookings_task",
            "schedule_type": Schedule.MINUTES,
            "minutes": 1,
            "repeats": -1,
        },
    )
    Schedule.objects.update_or_create(
        name="bookings.check_in_reminder",
        defaults={
            "func": "bookings.tasks.send_check_in_reminders_task",
            "schedule_type": Schedule.DAILY,
            "next_run": _next_8am_local_utc(),
            "repeats": -1,
        },
    )
