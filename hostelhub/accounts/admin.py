"""Accounts Django admin registration."""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, StudentProfile, HostelAdminProfile, OTPCode


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["phone", "role", "first_name", "last_name", "is_active", "is_verified", "date_joined"]
    list_filter = ["role", "is_active", "is_verified"]
    search_fields = ["phone", "email", "first_name", "last_name"]
    ordering = ["-date_joined"]
    readonly_fields = ["id", "date_joined", "last_login"]

    fieldsets = (
        (None, {"fields": ("id", "phone", "email", "password")}),
        ("Personal", {"fields": ("first_name", "last_name")}),
        ("Role & Status", {"fields": ("role", "is_active", "is_verified", "is_staff", "is_superuser")}),
        ("Timestamps", {"fields": ("date_joined", "last_login")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("phone", "email", "role", "password1", "password2"),
        }),
    )
    filter_horizontal = ("groups", "user_permissions")


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "program", "level", "gender"]
    search_fields = ["user__phone", "program"]
    list_filter = ["level", "gender"]


@admin.register(HostelAdminProfile)
class HostelAdminProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "business_name", "whatsapp_number", "is_tech_setup_required"]
    search_fields = ["user__phone", "business_name"]


@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
    list_display = ["phone", "attempts", "expires_at", "consumed_at", "created_at"]
    list_filter = ["consumed_at"]
    search_fields = ["phone"]
    readonly_fields = ["id", "phone", "code_hash", "created_at"]
    ordering = ["-created_at"]
