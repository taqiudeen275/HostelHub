"""Custom DRF permissions for role-based access control."""
from rest_framework.permissions import BasePermission

from .models import UserRole


class IsSuperAdmin(BasePermission):
    """Only Super Admin role."""
    message = "Access restricted to Super Admins."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == UserRole.SUPER_ADMIN
        )


class IsHostelAdmin(BasePermission):
    """Only Hostel Admin role."""
    message = "Access restricted to Hostel Admins."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == UserRole.HOSTEL_ADMIN
        )


class IsStudent(BasePermission):
    """Only Student role."""
    message = "Access restricted to Students."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == UserRole.STUDENT
        )


class IsSuperAdminOrHostelAdmin(BasePermission):
    """Super Admin or Hostel Admin."""
    message = "Access restricted to admins."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in (UserRole.SUPER_ADMIN, UserRole.HOSTEL_ADMIN)
        )


class IsOwner(BasePermission):
    """
    Object-level: the requesting user must be the 'owner' of the object.
    The view must set `owner_field` attribute (default: 'owner').
    """
    message = "You do not have permission to modify this resource."

    def has_object_permission(self, request, view, obj):
        owner_field = getattr(view, "owner_field", "owner")
        owner = getattr(obj, owner_field, None)
        return owner == request.user
