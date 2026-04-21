"""Main URL configuration for HostelHub."""
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include

urlpatterns = [
    # Django built-in admin
    path("django-admin/", admin.site.urls),

    # API v1
    path("api/v1/", include([
        path("", include("core.urls")),
        path("", include("accounts.urls")),
        path("", include("hostels.urls")),
        path("bookings/", include("bookings.urls")),
        path("payments/", include("payments.urls")),
    ])),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
