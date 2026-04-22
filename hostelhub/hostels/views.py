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

from accounts.permissions import IsHostelAdmin, IsSuperAdminOrHostelAdmin, IsOwnerOfHostel
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

class AmenityViewSet(viewsets.ModelViewSet):
    """List available amenities, and allow Admins to dynamically create missing ones."""
    queryset = Amenity.objects.all().order_by('name')
    serializer_class = AmenitySerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        # Case insensitive duplicate check
        name = request.data.get('name', '').strip()
        if not name:
            return Response({"error": "Name is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Look for existing amenity (case insensitive)
        existing = Amenity.objects.filter(name__iexact=name).first()
        if existing:
            return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)
            
        # Create new and return
        new_amenity = Amenity.objects.create(name=name, icon='sparkles')
        return Response(self.get_serializer(new_amenity).data, status=status.HTTP_201_CREATED)


class AdminVariantViewSet(viewsets.ModelViewSet):
    """
    Manage existing Room Variants and their Rooms.

    POST /api/v1/admin/variants/{id}/rooms/bulk/
    POST /api/v1/admin/variants/{id}/media/       — GAP-M2-10
    DELETE /api/v1/admin/variants/{id}/media/{media_pk}/  — GAP-M2-10
    """
    serializer_class = RoomVariantSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOrHostelAdmin]

    def get_queryset(self):
        if self.request.user.role == 'SUPER_ADMIN':
            return RoomVariant.objects.all()
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

from accounts.permissions import IsSuperAdmin
from core.models import AuditLog, ActionType
from django.contrib.contenttypes.models import ContentType

class SuperAdminHostelViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Super Admin viewset for approving/rejecting hostels and viewing PENDING queue.
    """
    serializer_class = HostelSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    pagination_class = None

    def get_queryset(self):
        status_filter = self.request.query_params.get('status', HostelStatus.PENDING)
        if status_filter.upper() == 'ALL':
            return Hostel.objects.all().order_by('-created_at')
        return Hostel.objects.filter(status=status_filter).order_by('-created_at')

    @action(detail=True, methods=['post'])
    def reassign(self, request, pk=None):
        hostel = self.get_object()
        
        # Security constraints
        if not hostel.created_by_super_admin:
            return Response({"error": "You can only reassign hostels created through the Super Admin portal."}, status=status.HTTP_403_FORBIDDEN)
            
        if hostel.owner != request.user:
            return Response({"error": "This hostel has already been transferred to another owner. One-way lock engaged."}, status=status.HTTP_403_FORBIDDEN)
            
        target_phone = request.data.get('phone')
        
        if not target_phone:
            return Response({"error": "Target phone number is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        from accounts.models import User
        
        try:
            target_user = User.objects.get(phone=target_phone)
        except User.DoesNotExist:
            return Response({"error": f"No user found with phone {target_phone}."}, status=status.HTTP_404_NOT_FOUND)
            
        if target_user.role != 'HOSTEL_ADMIN':
            return Response({"error": "Target user must have the HOSTEL_ADMIN role."}, status=status.HTTP_400_BAD_REQUEST)
            
        old_owner = hostel.owner
        hostel.owner = target_user
        hostel.save(update_fields=['owner'])
        
        target_ct = ContentType.objects.get_for_model(Hostel)
        AuditLog.objects.create(
            actor=request.user,
            action=ActionType.REASSIGN,
            target_content_type=target_ct,
            target_object_id=hostel.id,
            notes=f"Reassigned hostel '{hostel.name}' from {old_owner.phone if old_owner else 'None'} to {target_user.phone}"
        )
        return Response({"message": f"Hostel successfully reassigned to {target_user.phone}"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        hostel = self.get_object()
        if hostel.status == HostelStatus.APPROVED:
            return Response({"error": "Hostel already approved."}, status=status.HTTP_400_BAD_REQUEST)
        
        hostel.status = HostelStatus.APPROVED
        hostel.rejection_reason = None
        hostel.save(update_fields=['status', 'rejection_reason'])

        target_ct = ContentType.objects.get_for_model(Hostel)
        AuditLog.objects.create(
            actor=request.user,
            action=ActionType.APPROVE,
            target_content_type=target_ct,
            target_object_id=hostel.id,
            notes=f"Approved hostel {hostel.name}"
        )

        # GAP-M3-05: SMS stub — non-fatal
        try:
            from notifications.services import send_hostel_approval_sms
            send_hostel_approval_sms(
                phone=hostel.owner_contact_phone,
                hostel_name=hostel.name,
                approved=True,
            )
        except Exception:
            pass

        return Response({"message": "Hostel approved successfully."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        hostel = self.get_object()
        reason = request.data.get('reason')
        if not reason:
            return Response({"error": "Rejection reason is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        hostel.status = HostelStatus.REJECTED
        hostel.rejection_reason = reason
        hostel.save(update_fields=['status', 'rejection_reason'])

        target_ct = ContentType.objects.get_for_model(Hostel)
        AuditLog.objects.create(
            actor=request.user,
            action=ActionType.REJECT,
            target_content_type=target_ct,
            target_object_id=hostel.id,
            notes=f"Rejected hostel {hostel.name}. Reason: {reason}"
        )

        # GAP-M3-05: SMS stub — non-fatal, resolves in W12
        try:
            from notifications.services import send_hostel_approval_sms
            send_hostel_approval_sms(
                phone=hostel.owner_contact_phone,
                hostel_name=hostel.name,
                approved=False,
                reason=reason,
            )
        except Exception:
            pass

        # GAP-M3-01: Fixed — was missing return, caused 500
        return Response({"message": "Hostel rejected.", "reason": reason}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='create-on-behalf')
    def create_on_behalf(self, request):
        name = request.data.get('name')

        if not name:
            return Response({"error": "Hostel Name is required."}, status=status.HTTP_400_BAD_REQUEST)

        hostel_fields = {
            'owner': request.user,
            'name': name,
            'description': request.data.get('description', ''),
            'address_text': request.data.get('address_text', ''),
            'gender_policy': request.data.get('gender_policy', 'MIXED'),
            'owner_contact_phone': request.data.get('owner_contact_phone', ''),
            'owner_contact_whatsapp': request.data.get('owner_contact_whatsapp', ''),
            'status': HostelStatus.APPROVED,
            'created_by_super_admin': True,
        }
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        if lat:
            hostel_fields['latitude'] = lat
        if lng:
            hostel_fields['longitude'] = lng

        hostel = Hostel.objects.create(**hostel_fields)

        amenity_ids = request.data.get('amenity_ids', [])
        if amenity_ids:
            hostel.amenities.set(Amenity.objects.filter(id__in=amenity_ids))

        target_ct = ContentType.objects.get_for_model(Hostel)
        AuditLog.objects.create(
            actor=request.user,
            action=ActionType.CREATE_ON_BEHALF,
            target_content_type=target_ct,
            target_object_id=hostel.id,
            notes=f"Created hostel '{hostel.name}' under Super Admin inventory"
        )

        return Response(HostelSerializer(hostel).data, status=status.HTTP_201_CREATED)

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.permissions import AllowAny
from .filters import PublicHostelFilter


class PublicHostelViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public ViewSet for browsing APPROVED hostels (FR-5).

    Supported query params:
        ?gender_policy=MALE|FEMALE|MIXED
        ?min_price=500 / ?max_price=3000
        ?amenities=1&amenities=3  (multi-select)
        ?search=kwame              (searches name, description, address)
        ?ordering=created_at|-created_at  (newest/oldest)
    """
    serializer_class = HostelSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = PublicHostelFilter
    search_fields = ['name', 'description', 'address_text']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        return (
            Hostel.objects
            .filter(status=HostelStatus.APPROVED)
            .prefetch_related('media', 'variants__rooms', 'amenities')
            .distinct()
            .order_by('-created_at')
        )

class AdminHostelViewSet(viewsets.ModelViewSet):
    """
    Hostel Admins manage their own hostels.

    Changes:
        GAP-M2-08  perform_update enforces FR-2.5 re-PENDING on core field changes.
        GAP-M2-11  POST /{id}/submit/ requires ≥3 photos before setting PENDING.
    """
    serializer_class = HostelSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOrHostelAdmin]

    def get_queryset(self):
        if self.request.user.role == 'SUPER_ADMIN':
            return Hostel.objects.all().order_by('-created_at')
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
