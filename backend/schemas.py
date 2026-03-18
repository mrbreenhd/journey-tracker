import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# --- Trip ---

class TripCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class TripCreatedResponse(BaseModel):
    public_slug: str
    secret_code: str
    name: str


class PhotoOut(BaseModel):
    id: str
    filename: str
    original_name: str
    mime_type: str
    width: int | None
    height: int | None
    uploaded_at: datetime
    url: str


class CheckinOut(BaseModel):
    id: str
    latitude: float
    longitude: float
    altitude: float | None
    accuracy: float | None
    location_name: str | None
    note: str | None
    checked_in_at: datetime
    photos: list[PhotoOut]


class TripOut(BaseModel):
    id: str
    name: str
    public_slug: str
    created_at: datetime
    started_at: datetime | None
    checkins: list[CheckinOut]


class TripStats(BaseModel):
    total_distance_km: float
    total_duration_seconds: float
    average_speed_kmh: float
    checkin_count: int
    started_at: datetime | None
    latest_checkin_at: datetime | None


# --- Checkin ---

class CheckinCreate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    altitude: float | None = None
    accuracy: float | None = None
    note: str | None = Field(None, max_length=2000)
