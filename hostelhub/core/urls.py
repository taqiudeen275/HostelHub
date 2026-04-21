from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ping, AuditLogViewSet

router = DefaultRouter()
router.register(r'audit', AuditLogViewSet, basename='audit')

urlpatterns = [
    path("ping/", ping, name="ping"),
    path("", include(router.urls)),
]
