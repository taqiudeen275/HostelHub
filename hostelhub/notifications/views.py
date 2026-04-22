"""Notifications HTTP endpoints — SMS broadcast + preview + log."""
from __future__ import annotations

import logging

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from accounts.models import UserRole
from accounts.permissions import IsHostelAdmin
from core.pagination import StandardResultsPagination
from hostels.models import Hostel

from . import services


logger = logging.getLogger(__name__)


MAX_MESSAGE_LENGTH = 459   # 3 SMS segments (PRD §8.5)


class SMSBroadcastThrottle(UserRateThrottle):
    """Uses the `sms_broadcast` rate from settings (3/hour per admin)."""
    scope = "sms_broadcast"


def _get_hostel_for_admin(request, hostel_id):
    """Fetch a hostel only if the caller owns it, else return a 403 response."""
    hostel = get_object_or_404(Hostel, pk=hostel_id)
    if request.user.role == UserRole.SUPER_ADMIN:
        return hostel, None
    if hostel.owner_id != request.user.id:
        return None, Response(
            {"error": "You don't own this hostel."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return hostel, None


class SMSBroadcastPreviewView(APIView):
    """
    GET /api/v1/admin/hostels/{id}/sms-broadcast/preview/?message=...
    Returns audience_count + segments + estimated cost without sending.
    """
    permission_classes = [IsHostelAdmin]

    def get(self, request, hostel_id):
        hostel, err = _get_hostel_for_admin(request, hostel_id)
        if err is not None:
            return err

        message = request.query_params.get("message", "") or ""
        segments = services.compute_segments(message)
        audience = services.get_hostel_broadcast_audience(hostel)
        cost = services.compute_broadcast_cost(segments, len(audience))
        return Response({
            "audience_count": len(audience),
            "segments": segments,
            "character_count": len(message),
            "max_length": MAX_MESSAGE_LENGTH,
            "estimated_cost_ghs": str(cost),
        })


class SMSBroadcastView(APIView):
    """
    POST /api/v1/admin/hostels/{id}/sms-broadcast/
    Body: {"message": "Reminder: water off Saturday."}
    """
    permission_classes = [IsHostelAdmin]
    throttle_classes = [SMSBroadcastThrottle]

    def post(self, request, hostel_id):
        hostel, err = _get_hostel_for_admin(request, hostel_id)
        if err is not None:
            return err

        message = (request.data.get("message") or "").strip()
        if not message:
            return Response(
                {"error": "Message body is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(message) > MAX_MESSAGE_LENGTH:
            return Response(
                {"error": f"Message exceeds the {MAX_MESSAGE_LENGTH}-character cap (3 SMS segments)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        summary = services.broadcast_to_hostel_bookers(
            hostel=hostel, body=message, sent_by=request.user
        )
        return Response(summary, status=status.HTTP_202_ACCEPTED)


class SMSBroadcastLogView(APIView):
    """
    GET /api/v1/admin/hostels/{id}/sms-log/
    Paginated log of broadcasts sent on this hostel.
    """
    permission_classes = [IsHostelAdmin]

    def get(self, request, hostel_id):
        hostel, err = _get_hostel_for_admin(request, hostel_id)
        if err is not None:
            return err

        qs = services.get_broadcast_log(hostel, sent_by=request.user)
        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        data = [
            {
                "id": m.id,
                "to_phone": m.to_phone,
                "body": m.body,
                "status": m.status,
                "template_key": m.template_key,
                "cost": str(m.cost) if m.cost is not None else None,
                "created_at": m.created_at,
            }
            for m in (page or [])
        ]
        return paginator.get_paginated_response(data)
