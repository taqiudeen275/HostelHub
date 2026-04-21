import io
from django.core.files.base import ContentFile
from PIL import Image

def generate_thumbnails(image_file):
    """
    Takes an InMemoryUploadedFile or suitable Django file object,
    generates 400px and 1000px thumbnails, and returns two ContentFile objects.
    """
    try:
        img = Image.open(image_file)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
    except Exception:
        return None, None

    # Generate 400px thumbnail
    img_400 = img.copy()
    img_400.thumbnail((400, 400), Image.Resampling.LANCZOS)
    buffer_400 = io.BytesIO()
    img_400.save(buffer_400, format="JPEG", quality=85, optimize=True)
    thumb_400 = ContentFile(buffer_400.getvalue(), name=f"{image_file.name}_400.jpg")

    # Generate 1000px medium
    img_1000 = img.copy()
    img_1000.thumbnail((1000, 1000), Image.Resampling.LANCZOS)
    buffer_1000 = io.BytesIO()
    img_1000.save(buffer_1000, format="JPEG", quality=85, optimize=True)
    thumb_1000 = ContentFile(buffer_1000.getvalue(), name=f"{image_file.name}_1000.jpg")

    return thumb_400, thumb_1000
