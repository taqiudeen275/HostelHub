"""
Notifications app — SMS adapter infrastructure.

The rest of the codebase calls:
    from notifications.services import send_sms, send_otp_sms
and never touches the HTTP client directly, making it trivial to swap providers
or fake in tests by changing SMS_BACKEND in .env.
"""
