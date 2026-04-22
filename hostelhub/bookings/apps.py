from django.apps import AppConfig
from django.conf import settings
from django.db.models.signals import post_migrate


class BookingsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "bookings"

    def ready(self):
        # Register the expiry schedule once the DB is ready. Guarded so tests
        # (which don't run Q) don't touch the Schedule model on every startup.
        if getattr(settings, "BOOKINGS_REGISTER_SCHEDULE", True):
            post_migrate.connect(_register_schedule, sender=self)


def _register_schedule(sender, **kwargs):  # pragma: no cover - runtime wiring
    from .tasks import register_schedule
    try:
        register_schedule()
    except Exception:
        # Don't let schedule registration break migrations.
        pass
