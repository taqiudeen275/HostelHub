from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdminHostelViewSet, AmenityViewSet, AdminVariantViewSet

router = DefaultRouter()
router.register(r'admin/hostels', AdminHostelViewSet, basename='admin-hostel')
router.register(r'admin/variants', AdminVariantViewSet, basename='admin-variant')
router.register(r'amenities', AmenityViewSet, basename='amenity')

urlpatterns = [
    path('', include(router.urls)),
]
