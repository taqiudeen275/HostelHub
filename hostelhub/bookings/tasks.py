"""Background tasks for bookings — scheduled via Django-Q2."""
import logging

from .services import expire_stale_bookings


logger = logging.getLogger(__name__)


def expire_pending_bookings_task():
    """
    Called every minute by the Django-Q schedule. Sweeps PENDING_PAYMENT
    bookings whose 15-min window has closed and releases their slots.
    """
    try:
        count = expire_stale_bookings()
        if count:
            logger.info("Expired %d stale PENDING_PAYMENT bookings.", count)
    except Exception:  # pragma: no cover
        logger.exception("expire_pending_bookings_task crashed")


def register_schedule():
    """
    Idempotently register the minute-by-minute schedule. Called from AppConfig.ready().
    Safe to call multiple times.
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
