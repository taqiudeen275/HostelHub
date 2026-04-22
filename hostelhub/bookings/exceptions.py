"""Booking service exceptions — caught by views and surfaced as 4xx."""


class BookingError(Exception):
    """Base class for booking domain errors."""


class InvalidOccupancyError(BookingError):
    """Chosen occupancy is outside [variant.min_occupancy, variant.max_occupancy]."""


class OccupancyLockedError(BookingError):
    """Room already has a locked k; caller may not override it."""


class RoomFullError(BookingError):
    """The room has no remaining slots under its current locked k."""


class RoomUnavailableError(BookingError):
    """Room is flagged UNAVAILABLE by the hostel admin; bookings blocked."""


class HostelNotApprovedError(BookingError):
    """Booking blocked because the parent hostel is not APPROVED."""


class BookingNotCancellableError(BookingError):
    """Booking is in a state that doesn't permit cancellation."""
