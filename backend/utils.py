import math
import secrets
import string
import uuid
from pathlib import Path

import httpx
from PIL import Image

from backend.config import settings

EARTH_RADIUS_KM = 6371.0


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two GPS points in km."""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return EARTH_RADIUS_KM * c


def generate_slug(length: int = 8) -> str:
    """Generate a short URL-safe slug."""
    chars = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


def generate_secret_code(length: int = 12) -> str:
    """Generate a human-readable secret code."""
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


async def reverse_geocode(lat: float, lon: float) -> str | None:
    """Use Mapbox Geocoding API to resolve a lat/lon to a place name."""
    if not settings.mapbox_token:
        return None
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lon},{lat}.json"
    params = {
        "access_token": settings.mapbox_token,
        "types": "place,locality,neighborhood",
        "limit": 1,
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            features = data.get("features", [])
            if features:
                return features[0].get("place_name", features[0].get("text"))
    except Exception:
        pass
    return None


ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"}
MAX_THUMBNAIL_WIDTH = 800


def save_upload(file_bytes: bytes, original_name: str, mime_type: str) -> tuple[str, int | None, int | None]:
    """Save an uploaded photo to disk. Returns (filename, width, height)."""
    ext_map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/heic": ".heic",
        "image/heif": ".heif",
        "image/webp": ".webp",
    }
    ext = ext_map.get(mime_type, ".jpg")
    filename = f"{uuid.uuid4().hex}{ext}"
    upload_path = Path(settings.upload_dir)
    upload_path.mkdir(parents=True, exist_ok=True)
    filepath = upload_path / filename

    filepath.write_bytes(file_bytes)

    # Try to get dimensions and create a reasonably-sized version
    width, height = None, None
    try:
        with Image.open(filepath) as img:
            width, height = img.size
            if width > MAX_THUMBNAIL_WIDTH:
                ratio = MAX_THUMBNAIL_WIDTH / width
                new_size = (MAX_THUMBNAIL_WIDTH, int(height * ratio))
                img = img.resize(new_size, Image.LANCZOS)
                img.save(filepath, quality=85)
                width, height = new_size
    except Exception:
        pass

    return filename, width, height
