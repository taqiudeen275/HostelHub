"""Custom user manager for phone-based auth."""
from django.contrib.auth.base_user import BaseUserManager


class UserManager(BaseUserManager):
    """Manager for the custom User model using phone as the unique identifier."""

    def create_user(self, phone, role, password=None, **extra_fields):
        if not phone:
            raise ValueError("Phone number is required.")
        user = self.model(phone=phone, role=role, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()   # OTP-only users have no password
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, password, **extra_fields):
        """Creates a Super Admin with a usable password (for Django admin access)."""
        from .models import UserRole
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_verified", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        # role is passed in extra_fields — don't also pass as positional arg
        return self.create_user(phone, role=UserRole.SUPER_ADMIN, password=password, **extra_fields)
