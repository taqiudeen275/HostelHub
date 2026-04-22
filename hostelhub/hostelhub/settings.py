"""
Django settings for hostelhub project.
"""
from datetime import timedelta
from pathlib import Path

import environ

# ---------------------------------------------------------------------------
# Base directory
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
env = environ.Env(
    DEBUG=(bool, True),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(list, ["http://localhost:3000"]),
    SMS_BACKEND=(str, "console"),
    JWT_ACCESS_TOKEN_LIFETIME_HOURS=(int, 1),
    JWT_REFRESH_TOKEN_LIFETIME_DAYS=(int, 14),
)
environ.Env.read_env(BASE_DIR / ".env")

# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

# ---------------------------------------------------------------------------
# Application definition
# ---------------------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_q",
    "django_filters",
]

LOCAL_APPS = [
    "core",
    "accounts",
    "hostels",
    "bookings",
    "payments",
    "notifications",
    "reviews",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",          # must be before CommonMiddleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "hostelhub.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "hostelhub.wsgi.application"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DATABASES = {
    "default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR}/db.sqlite3")
}

# ---------------------------------------------------------------------------
# Custom user model
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

# ---------------------------------------------------------------------------
# Password validation + hashing
# ---------------------------------------------------------------------------
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",  # for super admin password
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Accra"   # GMT+0, no DST — Ghana
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static & Media files
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / env("MEDIA_ROOT", default="media")

# ---------------------------------------------------------------------------
# Default primary key field type
# ---------------------------------------------------------------------------
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
from corsheaders.defaults import default_headers  # noqa: E402

CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True
# Custom headers used by the frontend. `X-HMS-Registration-Role` carries the
# role choice on first OTP verification (PRD §8.1).
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-hms-registration-role",
]

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "core.pagination.StandardResultsPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
        "otp_phone": "3/15min",   # custom: 3 OTPs per phone per 15 min
        "otp_ip": "10/hour",      # custom: 10 OTPs per IP per hour
        "booking_create": "10/hour",
        "sms_broadcast": "3/hour",
    },
    "EXCEPTION_HANDLER": "core.exceptions.custom_exception_handler",
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
}

# ---------------------------------------------------------------------------
# SimpleJWT
# ---------------------------------------------------------------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=env("JWT_ACCESS_TOKEN_LIFETIME_HOURS")),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env("JWT_REFRESH_TOKEN_LIFETIME_DAYS")),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ---------------------------------------------------------------------------
# SMS / Notifications
# ---------------------------------------------------------------------------
SMS_BACKEND = env("SMS_BACKEND")   # "console" or "arkesel"

# Arkesel SMS provider config
# ↓ Flip to "arkesel" in .env to send real SMS
ARKESEL_API_KEY = env("ARKESEL_API_KEY", default="")
ARKESEL_SENDER_ID = env("ARKESEL_SENDER_ID", default="HostelHub")
# Set True in staging to hit real Arkesel API but not deliver to real handsets
ARKESEL_USE_SANDBOX = env.bool("ARKESEL_USE_SANDBOX", default=False)
# Optional: Arkesel will POST delivery reports to this URL
ARKESEL_CALLBACK_URL = env("ARKESEL_CALLBACK_URL", default="")
# SMS send retry policy
ARKESEL_MAX_RETRIES = env.int("ARKESEL_MAX_RETRIES", default=3)
ARKESEL_TIMEOUT = env.int("ARKESEL_TIMEOUT", default=10)

# Per-segment broadcast price estimate shown in the admin UI (pre-send).
# Arkesel's real per-message `cost` is persisted on SMSMessage after send.
SMS_BROADCAST_COST_PER_SEGMENT_GHS = env(
    "SMS_BROADCAST_COST_PER_SEGMENT_GHS", default="0.10"
)

# ---------------------------------------------------------------------------
# Paystack
# ---------------------------------------------------------------------------
PAYSTACK_SECRET_KEY = env("PAYSTACK_SECRET_KEY", default="")
PAYSTACK_PUBLIC_KEY = env("PAYSTACK_PUBLIC_KEY", default="")

# ---------------------------------------------------------------------------
# Django-Q (async task queue)
# ---------------------------------------------------------------------------
Q_CLUSTER = {
    "name": "hostelhub",
    "workers": 2,
    "recycle": 500,
    "timeout": 60,
    "compress": True,
    "save_limit": 250,
    "queue_limit": 500,
}

if env("REDIS_URL", default=""):
    Q_CLUSTER["redis"] = env("REDIS_URL")
else:
    Q_CLUSTER["orm"] = "default"

# ---------------------------------------------------------------------------
# OTP settings (common sense extras not in PRD but needed)
# ---------------------------------------------------------------------------
OTP_EXPIRY_SECONDS = 300        # 5 minutes
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN_SECONDS = 60
OTP_RATE_LIMIT_PER_PHONE = 3   # per 15 min
OTP_RATE_LIMIT_PER_IP = 10     # per hour
