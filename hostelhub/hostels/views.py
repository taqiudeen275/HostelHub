"""
Hostel Admin views.

Gaps addressed:
    GAP-M2-08  FR-2.5 — re-PENDING logic on core field edits of APPROVED hostels.
    GAP-M2-10  Per-variant media upload/delete endpoint.
    GAP-M2-11  Dedicated submit action enforcing ≥3 hostel photos before PENDING.
"""
import subprocess

from django.db import IntegrityError
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsHostelAdmin, IsOwnerOfHostel
from .media_processor import generate_thumbnails
from .models import (
    Hostel, Amenity, HostelStatus, HostelMedia, MediaType,
    RoomVariant, Room, RoomVariantMedia,
)
from .serializers import (
    HostelSerializer, AmenitySerializer, HostelMediaSerializer,
    RoomVariantSerializer, RoomVariantMediaSerializer, RoomBulkCreateSerializer,
)

# Core fields whose change on an APPROVED hostel triggers re-review (FR-2.5)
_CORE_FIELDS = {'name', 'address_text', 'latitude', 'longitude', 'owner_contact_phone'}


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def _probe_video_duration(file) -> int | None:
    """Try to extract video duration via ffprobe. Returns seconds or None."""
    try:
        result = subprocess.run(
            [
                'ffprobe', '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                'pipe:0',
            ],
            input=file.read(),
            capture_output=True,
            timeout=10,
        )
        file.seek(0)
        if result.returncode == 0:
            return int(float(result.stdout.decode().strip()))
    except Exception:
        pass
    return None


def _upload_media_to(*, file, caption: str = "") -> tuple:
    """
    Shared upload helper used by both hostel-level and variant-level endpoints.
    Returns (media_type, thumb_400, thumb_1000, duration_seconds).
    Raises ValueError on invalid input.
    """
    mime_type = file.content_type
    if mime_type.startswith('image/'):
        if file.size > 10 * 1024 * 1024:
            raise ValueError("Image file too large (max 10MB).")
        media_type = MediaType.PHOTO
        thumb_400, thumb_1000 = generate_thumbnails(file)
        return media_type, thumb_400, thumb_1000, None

    elif mime_type.startswith('video/'):
        if file.size > 50 * 1024 * 1024:
            raise ValueError("Video file too large (max 50MB).")
        media_type = MediaType.VIDEO
        duration = _probe_video_duration(file)
        return media_type, None, None, duration

    else:
        raise ValueError("Unsupported file type. Please upload images or videos.")


# ---------------------------------------------------------------------------
# ViewSets
# ---------------------------------------------------------------------------

class AmenityViewSet(viewsets.ReadOnlyModelViewSet):
    """Publicly list available amenities."""
    queryset = Amenity.objects.all().order_by('name')
    serializer_class = AmenitySerializer
    permission_classes = [permissions.AllowAny]


class AdminVariantViewSet(viewsets.ModelViewSet):
    """
    Manage existing Room Variants and their Rooms.

    POST /api/v1/admin/variants/{id}/rooms/bulk/
    POST /api/v1/admin/variants/{id}/media/       — GAP-M2-10
    DELETE /api/v1/admin/variants/{id}/media/{media_pk}/  — GAP-M2-10
    """
    serializer_class = RoomVariantSerializer
    permission_classes = [IsAuthenticated, IsHostelAdmin]

    def get_queryset(self):
        return RoomVariant.objects.filter(hostel__owner=self.request.user)

    @action(detail=True, methods=['post'], url_path='rooms/bulk', url_name='rooms_bulk')
    def bulk_create_rooms(self, request, pk=None):
        variant = self.get_object()
        serializer = RoomBulkCreateSerializer(data=request.data)
        if serializer.is_valid():
            labels = serializer.validated_data['labels']
            rooms_to_create = [Room(variant=variant, label=label) for label in labels]
            try:
                Room.objects.bulk_create(rooms_to_create)
                return Response(
                    {"message": f"{len(rooms_to_create)} rooms created successfully."},
                    status=status.HTTP_201_CREATED,
                )
            except IntegrityError:
                return Response(
                    {"error": "One or more room labels already exist for this variant."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # GAP-M2-10 — per-variant media upload
    @action(detail=True, methods=['post'], url_path='media', url_name='media')
    def upload_media(self, request, pk=None):
        variant = self.get_object()
        file = request.data.get('file')
        caption = request.data.get('caption', '')

        if not file:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            media_type, thumb_400, thumb_1000, duration = _upload_media_to(file=file, caption=caption)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        last = variant.media.order_by('-display_order').first()
        record = RoomVariantMedia(
            variant=variant,
            type=media_type,
            file=file,
            caption=caption,
            display_order=(last.display_order + 1) if last else 0,
            duration_seconds=duration,
        )
        if thumb_400 and thumb_1000:
            record.thumbnail = thumb_400
            record.medium = thumb_1000
        record.save()

        serializer = RoomVariantMediaSerializer(record)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # GAP-M2-10 — per-variant media delete
    @action(
        detail=True, methods=['delete'],
        url_path=r'media/(?P<media_pk>[^/.]+)', url_name='delete_media',
    )
    def delete_media(self, request, pk=None, media_pk=None):
        variant = self.get_object()
        try:
            record = RoomVariantMedia.objects.get(id=media_pk, variant=variant)
            for field in ('file', 'thumbnail', 'medium'):
                f = getattr(record, field)
                if f:
                    f.delete(save=False)
            record.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except RoomVariantMedia.DoesNotExist:
            return Response({"error": "Media not found."}, status=status.HTTP_404_NOT_FOUND)


class AdminHostelViewSet(viewsets.ModelViewSet):
    """
    Hostel Admins manage their own hostels.

    Changes:
        GAP-M2-08  perform_update enforces FR-2.5 re-PENDING on core field changes.
        GAP-M2-11  POST /{id}/submit/ requires ≥3 photos before setting PENDING.
    """
    serializer_class = HostelSerializer
    permission_classes = [IsAuthenticated, IsHostelAdmin, IsOwnerOfHostel]
    owner_field = 'owner'

    def get_queryset(self):
        return Hostel.objects.filter(owner=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        # New hostels start as DRAFT so the admin can upload media first (GAP-M2-11).
        serializer.save(owner=self.request.user, status=HostelStatus.DRAFT)

    # GAP-M2-08 — FR-2.5: re-enter PENDING when core fields change on APPROVED hostel
    def perform_update(self, serializer):
        instance = self.get_object()
        changed_fields = set(serializer.validated_data.keys())
        if changed_fields & _CORE_FIELDS and instance.status == HostelStatus.APPROVED:
            serializer.save(status=HostelStatus.PENDING)
        else:
            serializer.save()

    # GAP-M2-11 — dedicated submit action enforces ≥3 hostel photos
    @action(detail=True, methods=['post'], url_path='submit', url_name='submit')
    def submit_for_review(self, request, pk=None):
        hostel = self.get_object()

        if hostel.status not in (HostelStatus.DRAFT, HostelStatus.REJECTED):
            return Response(
                {"error": f"Cannot submit a hostel with status '{hostel.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        photo_count = hostel.media.filter(type=MediaType.PHOTO).count()
        if photo_count < 3:
            return Response(
                {
                    "error": f"At least 3 photos are required before submission. "
                             f"You have {photo_count}."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not hostel.variants.exists():
            return Response(
                {"error": "At least one Room Variant is required before submission."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        hostel.status = HostelStatus.PENDING
        hostel.rejection_reason = None
        hostel.save(update_fields=['status', 'rejection_reason'])

        return Response(
            {"message": "Hostel submitted for review. You will be notified on approval."},
            status=status.HTTP_200_OK,
        )

    # Variants
    @action(detail=True, methods=['get', 'post'], url_path='variants', url_name='variants')
    def manage_variants(self, request, pk=None):
        hostel = self.get_object()
        if request.method == 'GET':
            serializer = RoomVariantSerializer(hostel.variants.all(), many=True)
            return Response(serializer.data)
        # POST
        serializer = RoomVariantSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(hostel=hostel)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # Hostel-level media upload
    @action(detail=True, methods=['post'], url_path='media', url_name='media')
    def upload_media(self, request, pk=None):
        hostel = self.get_object()
        file = request.data.get('file')
        caption = request.data.get('caption', '')

        if not file:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            media_type, thumb_400, thumb_1000, _ = _upload_media_to(file=file, caption=caption)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        last = hostel.media.order_by('-display_order').first()
        record = HostelMedia(
            hostel=hostel,
            type=media_type,
            file=file,
            caption=caption,
            display_order=(last.display_order + 1) if last else 0,
        )
        if thumb_400 and thumb_1000:
            record.thumbnail = thumb_400
            record.medium = thumb_1000
        record.save()

        serializer = HostelMediaSerializer(record)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # Hostel-level media reorder
    @action(detail=True, methods=['patch'], url_path='media-reorder', url_name='reorder_media')
    def reorder_media(self, request, pk=None):
        hostel = self.get_object()
        ordered_ids = request.data.get('order', [])

        if not isinstance(ordered_ids, list):
            return Response(
                {"error": "Expected an array of media IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        media_dict = {m.id: m for m in hostel.media.all()}
        for idx, media_id in enumerate(ordered_ids):
            media = media_dict.get(int(media_id))
            if media:
                media.display_order = idx
                media.save(update_fields=['display_order'])

        return Response({"message": "Media reordered successfully."})

    # Hostel-level media delete
    @action(
        detail=True, methods=['delete'],
        url_path=r'media/(?P<media_pk>[^/.]+)', url_name='delete_media',
    )
    def delete_media(self, request, pk=None, media_pk=None):
        hostel = self.get_object()
        try:
            record = HostelMedia.objects.get(id=media_pk, hostel=hostel)
            for field in ('file', 'thumbnail', 'medium'):
                f = getattr(record, field)
                if f:
                    f.delete(save=False)
            record.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except HostelMedia.DoesNotExist:
            return Response({"error": "Media not found."}, status=status.HTTP_404_NOT_FOUND)
