from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from .models import Amenity, Hostel, HostelMedia, MediaType, RoomVariant, Room

class AmenitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Amenity
        fields = ['id', 'name', 'icon']

class HostelMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = HostelMedia
        fields = ['id', 'type', 'file', 'thumbnail', 'medium', 'caption', 'display_order', 'created_at']
        read_only_fields = ['id', 'type', 'thumbnail', 'medium', 'created_at']

class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'variant', 'label', 'locked_k', 'status']
        read_only_fields = ['id', 'locked_k', 'status', 'variant']

class RoomBulkCreateSerializer(serializers.Serializer):
    labels = serializers.ListField(
        child=serializers.CharField(max_length=50)
    )

class RoomVariantSerializer(serializers.ModelSerializer):
    rooms = RoomSerializer(many=True, read_only=True)
    
    class Meta:
        model = RoomVariant
        fields = ['id', 'hostel', 'name', 'description', 'total_price', 'min_occupancy', 'max_occupancy', 'features', 'rooms', 'created_at']
        read_only_fields = ['id', 'hostel', 'created_at']

    def validate(self, data):
        min_occ = data.get('min_occupancy', self.instance.min_occupancy if self.instance else 1)
        max_occ = data.get('max_occupancy', self.instance.max_occupancy if self.instance else None)
        price = data.get('total_price', self.instance.total_price if self.instance else None)

        if min_occ < 1:
            raise ValidationError({"min_occupancy": "Minimum occupancy must be at least 1."})
        
        if max_occ is not None and max_occ < min_occ:
            raise ValidationError({"max_occupancy": "Maximum occupancy cannot be less than minimum occupancy."})

        if price is not None and price <= 0:
            raise ValidationError({"total_price": "Total price must be greater than 0."})
            
        return data

class HostelSerializer(serializers.ModelSerializer):
    amenities = AmenitySerializer(many=True, read_only=True)
    media = HostelMediaSerializer(many=True, read_only=True)
    variants = RoomVariantSerializer(many=True, read_only=True)
    amenity_ids = serializers.PrimaryKeyRelatedField(
        queryset=Amenity.objects.all(), 
        source='amenities', 
        many=True, 
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Hostel
        fields = [
            'id', 'owner', 'name', 'slug', 'description', 
            'address_text', 'latitude', 'longitude', 
            'gender_policy', 'owner_contact_phone', 
            'owner_contact_whatsapp', 'status', 'rejection_reason',
            'created_by_super_admin', 'amenities', 'amenity_ids', 'media',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'owner', 'slug', 'status', 'rejection_reason', 
            'created_by_super_admin', 'created_at', 'updated_at'
        ]

    def create(self, validated_data):
        amenities = validated_data.pop('amenities', [])
        hostel = Hostel.objects.create(**validated_data)
        if amenities:
            hostel.amenities.set(amenities)
        return hostel

    def update(self, instance, validated_data):
        amenities = validated_data.pop('amenities', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if amenities is not None:
            instance.amenities.set(amenities)
        return instance
