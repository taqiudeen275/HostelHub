"""
M3 Hostel filter set — price range, amenities (multi), gender policy, search, ordering.
Used by PublicHostelViewSet (FR-5.2, FR-5.4).
"""
from django_filters import rest_framework as filters

from .models import Amenity, Hostel


class PublicHostelFilter(filters.FilterSet):
    """
    Supports the following query params:

        ?gender_policy=MALE|FEMALE|MIXED
        ?min_price=500         (minimum variant price)
        ?max_price=3000        (maximum variant price)
        ?amenities=1&amenities=3  (multi-select amenity IDs)
        ?search=<text>         (handled separately by SearchFilter)
        ?ordering=created_at|-created_at  (handled by OrderingFilter)
    """
    gender_policy = filters.ChoiceFilter(
        choices=[("MALE", "Male Only"), ("FEMALE", "Female Only"), ("MIXED", "Mixed")]
    )
    min_price = filters.NumberFilter(
        field_name="variants__total_price",
        lookup_expr="gte",
        label="Minimum price (GHS)",
    )
    max_price = filters.NumberFilter(
        field_name="variants__total_price",
        lookup_expr="lte",
        label="Maximum price (GHS)",
    )
    amenities = filters.ModelMultipleChoiceFilter(
        field_name="amenities",
        queryset=Amenity.objects.all(),
        label="Amenities (multi-select by ID)",
    )

    class Meta:
        model = Hostel
        fields = ["gender_policy", "min_price", "max_price", "amenities"]
