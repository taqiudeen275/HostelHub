from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import IsHostelAdmin, IsOwnerOfHostel
from .models import Hostel, Amenity, HostelStatus, HostelMedia, MediaType, RoomVariant, Room
from .serializers import HostelSerializer, AmenitySerializer, HostelMediaSerializer, RoomVariantSerializer, RoomBulkCreateSerializer
from .media_processor import generate_thumbnails
from rest_framework.decorators import action
from django.db import IntegrityError

class AmenityViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Publicly list available amenities.
    """
    queryset = Amenity.objects.all().order_by('name')
    serializer_class = AmenitySerializer
    permission_classes = [permissions.AllowAny]


class AdminVariantViewSet(viewsets.ModelViewSet):
    """
    Viewset to manage existing Room Variants and their Rooms.
    POST /api/v1/admin/variants/{id}/rooms/bulk/
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
                return Response({"message": f"{len(rooms_to_create)} rooms created successfully."}, status=status.HTTP_201_CREATED)
            except IntegrityError:
                return Response({"error": "One or more room labels already exist for this variant."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AdminHostelViewSet(viewsets.ModelViewSet):
    """
    Viewset for Hostel Admins to manage their own hostels.
    """
    serializer_class = HostelSerializer
    permission_classes = [IsAuthenticated, IsHostelAdmin, IsOwnerOfHostel]
    owner_field = 'owner'

    def get_queryset(self):
        return Hostel.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(
            owner=self.request.user,
            status=HostelStatus.PENDING
        )

    @action(detail=True, methods=['get', 'post'], url_path='variants', url_name='variants')
    def manage_variants(self, request, pk=None):
        hostel = self.get_object()
        if request.method == 'GET':
            variants = hostel.variants.all()
            serializer = RoomVariantSerializer(variants, many=True)
            return Response(serializer.data)
        elif request.method == 'POST':
            serializer = RoomVariantSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(hostel=hostel)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='media', url_name='media')

    def upload_media(self, request, pk=None):
        hostel = self.get_object()
        file = request.data.get('file')
        caption = request.data.get('caption', '')
        
        if not file:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        # Basic server-side validation
        mime_type = file.content_type
        
        if mime_type.startswith('image/'):
            media_type = MediaType.PHOTO
            if file.size > 10 * 1024 * 1024:
                return Response({"error": "Image file too large (max 10MB)."}, status=status.HTTP_400_BAD_REQUEST)
        elif mime_type.startswith('video/'):
            media_type = MediaType.VIDEO
            if file.size > 50 * 1024 * 1024:
                return Response({"error": "Video file too large (max 50MB)."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"error": "Unsupported file type. Please upload images or videos."}, status=status.HTTP_400_BAD_REQUEST)

        # Create media record
        media_record = HostelMedia(
            hostel=hostel,
            type=media_type,
            file=file,
            caption=caption
        )

        # Generate thumbs if photo
        if media_type == MediaType.PHOTO:
            thumb_400, thumb_1000 = generate_thumbnails(file)
            if thumb_400 and thumb_1000:
                media_record.thumbnail = thumb_400
                media_record.medium = thumb_1000
                
        media_record.save()
        
        serializer = HostelMediaSerializer(media_record)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='media/(?P<media_pk>[^/.]+)', url_name='delete_media')
    def delete_media(self, request, pk=None, media_pk=None):
        hostel = self.get_object()
        try:
            media_record = HostelMedia.objects.get(id=media_pk, hostel=hostel)
            
            # Delete files from storage
            if media_record.file:
                media_record.file.delete(save=False)
            if media_record.thumbnail:
                media_record.thumbnail.delete(save=False)
            if media_record.medium:
                media_record.medium.delete(save=False)
                
            media_record.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except HostelMedia.DoesNotExist:
            return Response({"error": "Media not found."}, status=status.HTTP_404_NOT_FOUND)


