"""Custom throttle classes for OTP rate limiting."""
from django.core.cache import cache
from rest_framework.throttling import SimpleRateThrottle


class OTPPhoneRateThrottle(SimpleRateThrottle):
    """
    Limits OTP requests per phone number: 3 per 15 minutes.
    Cache key is based on the normalized phone number in the request body.
    """
    scope = "otp_phone"
    rate = "3/15min"

    def get_cache_key(self, request, view):
        phone = request.data.get("phone", "")
        if not phone:
            return None
        # Use phone as the throttle identifier
        ident = f"otp_phone_{phone}"
        return self.cache_format % {"scope": self.scope, "ident": ident}

    def parse_rate(self, rate):
        """Override to handle '3/15min' format."""
        if rate is None:
            return (None, None)
        num, period = rate.split("/")
        num_requests = int(num)
        # Handle custom periods like 15min
        if period.endswith("min"):
            duration = int(period[:-3]) * 60
        elif period.endswith("hour"):
            duration = int(period[:-4]) * 3600
        elif period.endswith("day"):
            duration = int(period[:-3]) * 86400
        else:
            duration = {"s": 1, "m": 60, "h": 3600, "d": 86400}[period[-1]]
        return (num_requests, duration)


class OTPIPRateThrottle(SimpleRateThrottle):
    """
    Limits OTP requests per IP: 10 per hour.
    """
    scope = "otp_ip"
    rate = "10/hour"

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}

    def parse_rate(self, rate):
        if rate is None:
            return (None, None)
        num, period = rate.split("/")
        num_requests = int(num)
        period_map = {"hour": 3600, "min": 60, "day": 86400}
        for key, seconds in period_map.items():
            if period.endswith(key):
                duration = int(period[: -len(key)] or 1) * seconds
                return (num_requests, duration)
        return (num_requests, 3600)
