from django.contrib import admin
from .models import Amenity, Hostel, HostelMedia, RoomVariant, Room


@admin.register(Amenity)
class AmenityAdmin(admin.ModelAdmin):
    list_display = ["name", "icon"]
    search_fields = ["name"]
    ordering = ["name"]


@admin.register(Hostel)
class HostelAdmin(admin.ModelAdmin):
    list_display = ["name", "owner", "status", "gender_policy", "created_at"]
    list_filter = ["status", "gender_policy", "created_by_super_admin"]
    search_fields = ["name", "address_text", "owner__phone"]
    readonly_fields = ["id", "slug", "created_at", "updated_at"]
    raw_id_fields = ["owner"]
    ordering = ["-created_at"]


@admin.register(HostelMedia)
class HostelMediaAdmin(admin.ModelAdmin):
    list_display = ["hostel", "type", "display_order", "caption", "created_at"]
    list_filter = ["type"]
    search_fields = ["hostel__name", "caption"]
    ordering = ["hostel", "display_order"]


@admin.register(RoomVariant)
class RoomVariantAdmin(admin.ModelAdmin):
    list_display = ["name", "hostel", "total_price", "min_occupancy", "max_occupancy", "created_at"]
    list_filter = ["hostel"]
    search_fields = ["name", "hostel__name"]
    readonly_fields = ["id", "created_at"]
    ordering = ["hostel", "name"]


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ["label", "variant", "status", "locked_k"]
    list_filter = ["status", "variant__hostel"]
    search_fields = ["label", "variant__name", "variant__hostel__name"]
    readonly_fields = ["id"]
    ordering = ["variant", "label"]
