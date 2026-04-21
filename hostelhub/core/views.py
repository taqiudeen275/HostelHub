from rest_framework import viewsets, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import AuditLog
from rest_framework import serializers

@api_view(["GET"])
@permission_classes([AllowAny])
def ping(request):
    """Health check endpoint. No auth required."""
    return Response({"status": "ok", "service": "HostelHub API"})

class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source='actor.email', read_only=True)
    actor_phone = serializers.CharField(source='actor.phone', read_only=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'actor', 'actor_email', 'actor_phone', 'action', 'notes', 'created_at']

class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'SUPER_ADMIN')

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Super Admin endpoint to view global audit logs.
    GET /api/v1/core/audit/
    """
    permission_classes = [IsSuperAdmin]
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.select_related('actor').order_by('-created_at')
