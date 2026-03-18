import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File, Form
import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.models import Checkin, Photo, Trip
from backend.schemas import (
    CheckinCreate,
    CheckinOut,
    PhotoOut,
    TripCreate,
    TripCreatedResponse,
    TripOut,
    TripStats,
)
from backend.utils import (
    ALLOWED_MIME_TYPES,
    generate_secret_code,
    generate_slug,
    haversine,
    reverse_geocode,
    save_upload,
)

router = APIRouter()


# --- Helpers ---

async def _get_trip_by_slug(slug: str, db: AsyncSession) -> Trip:
    result = await db.execute(
        select(Trip)
        .where(Trip.public_slug == slug)
        .options(selectinload(Trip.checkins).selectinload(Checkin.photos))
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


def _verify_secret(trip: Trip, secret: str) -> None:
    if not bcrypt.checkpw(secret.encode(), trip.secret_code_hash.encode()):
        raise HTTPException(status_code=403, detail="Invalid trip secret")


def _photo_url(filename: str) -> str:
    return f"/api/uploads/{filename}"


def _checkin_to_out(c: Checkin) -> CheckinOut:
    return CheckinOut(
        id=str(c.id),
        latitude=c.latitude,
        longitude=c.longitude,
        altitude=c.altitude,
        accuracy=c.accuracy,
        location_name=c.location_name,
        note=c.note,
        checked_in_at=c.checked_in_at,
        photos=[
            PhotoOut(
                id=str(p.id),
                filename=p.filename,
                original_name=p.original_name,
                mime_type=p.mime_type,
                width=p.width,
                height=p.height,
                uploaded_at=p.uploaded_at,
                url=_photo_url(p.filename),
            )
            for p in c.photos
        ],
    )


# --- Routes ---

@router.post("/trips", response_model=TripCreatedResponse)
async def create_trip(body: TripCreate, db: AsyncSession = Depends(get_db)):
    secret = generate_secret_code()
    slug = generate_slug()

    trip = Trip(
        name=body.name,
        secret_code_hash=bcrypt.hashpw(secret.encode(), bcrypt.gensalt()).decode(),
        public_slug=slug,
    )
    db.add(trip)
    await db.commit()

    return TripCreatedResponse(
        public_slug=slug,
        secret_code=secret,
        name=trip.name,
    )


@router.get("/trips/{slug}", response_model=TripOut)
async def get_trip(slug: str, db: AsyncSession = Depends(get_db)):
    trip = await _get_trip_by_slug(slug, db)
    return TripOut(
        id=str(trip.id),
        name=trip.name,
        public_slug=trip.public_slug,
        created_at=trip.created_at,
        started_at=trip.started_at,
        checkins=[_checkin_to_out(c) for c in trip.checkins],
    )


@router.get("/trips/{slug}/stats", response_model=TripStats)
async def get_trip_stats(slug: str, db: AsyncSession = Depends(get_db)):
    trip = await _get_trip_by_slug(slug, db)
    checkins = sorted(trip.checkins, key=lambda c: c.checked_in_at)

    total_distance = 0.0
    for i in range(1, len(checkins)):
        total_distance += haversine(
            checkins[i - 1].latitude, checkins[i - 1].longitude,
            checkins[i].latitude, checkins[i].longitude,
        )

    total_duration = 0.0
    started = None
    latest = None
    if checkins:
        started = checkins[0].checked_in_at
        latest = checkins[-1].checked_in_at
        total_duration = (latest - started).total_seconds()

    avg_speed = (total_distance / (total_duration / 3600)) if total_duration > 0 else 0.0

    return TripStats(
        total_distance_km=round(total_distance, 2),
        total_duration_seconds=total_duration,
        average_speed_kmh=round(avg_speed, 1),
        checkin_count=len(checkins),
        started_at=started,
        latest_checkin_at=latest,
    )


@router.post("/trips/{slug}/checkins", response_model=CheckinOut)
async def create_checkin(
    slug: str,
    latitude: float = Form(...),
    longitude: float = Form(...),
    altitude: float | None = Form(None),
    accuracy: float | None = Form(None),
    note: str | None = Form(None),
    photos: list[UploadFile] = File(default=[]),
    x_trip_secret: str = Header(..., alias="X-Trip-Secret"),
    db: AsyncSession = Depends(get_db),
):
    trip = await _get_trip_by_slug(slug, db)
    _verify_secret(trip, x_trip_secret)

    # Validate inputs
    if not (-90 <= latitude <= 90):
        raise HTTPException(status_code=422, detail="Invalid latitude")
    if not (-180 <= longitude <= 180):
        raise HTTPException(status_code=422, detail="Invalid longitude")
    if note and len(note) > 2000:
        raise HTTPException(status_code=422, detail="Note too long (max 2000 chars)")

    # Reverse geocode
    location_name = await reverse_geocode(latitude, longitude)

    # Set started_at on first checkin
    if trip.started_at is None:
        trip.started_at = datetime.now(timezone.utc)

    checkin = Checkin(
        trip_id=trip.id,
        latitude=latitude,
        longitude=longitude,
        altitude=altitude,
        accuracy=accuracy,
        location_name=location_name,
        note=note,
    )
    db.add(checkin)
    await db.flush()  # get checkin.id

    # Handle photo uploads
    photo_models = []
    for upload in photos:
        if upload.content_type not in ALLOWED_MIME_TYPES:
            continue
        content = await upload.read()
        if len(content) > 10 * 1024 * 1024:  # 10MB limit
            continue
        filename, w, h = save_upload(content, upload.filename or "photo.jpg", upload.content_type)
        photo = Photo(
            checkin_id=checkin.id,
            filename=filename,
            original_name=upload.filename or "photo.jpg",
            mime_type=upload.content_type,
            width=w,
            height=h,
        )
        db.add(photo)
        photo_models.append(photo)

    await db.commit()
    await db.refresh(checkin, attribute_names=["photos"])
    return _checkin_to_out(checkin)


@router.post("/trips/{slug}/checkins/{checkin_id}/photos", response_model=list[PhotoOut])
async def upload_photos(
    slug: str,
    checkin_id: uuid.UUID,
    photos: list[UploadFile] = File(...),
    x_trip_secret: str = Header(..., alias="X-Trip-Secret"),
    db: AsyncSession = Depends(get_db),
):
    trip = await _get_trip_by_slug(slug, db)
    _verify_secret(trip, x_trip_secret)

    result = await db.execute(
        select(Checkin).where(Checkin.id == checkin_id, Checkin.trip_id == trip.id)
    )
    checkin = result.scalar_one_or_none()
    if not checkin:
        raise HTTPException(status_code=404, detail="Checkin not found")

    uploaded: list[PhotoOut] = []
    for upload in photos:
        if upload.content_type not in ALLOWED_MIME_TYPES:
            continue
        content = await upload.read()
        if len(content) > 10 * 1024 * 1024:
            continue
        filename, w, h = save_upload(content, upload.filename or "photo.jpg", upload.content_type)
        photo = Photo(
            checkin_id=checkin.id,
            filename=filename,
            original_name=upload.filename or "photo.jpg",
            mime_type=upload.content_type,
            width=w,
            height=h,
        )
        db.add(photo)
        uploaded.append(PhotoOut(
            id=str(photo.id),
            filename=photo.filename,
            original_name=photo.original_name,
            mime_type=photo.mime_type,
            width=photo.width,
            height=photo.height,
            uploaded_at=photo.uploaded_at or datetime.now(timezone.utc),
            url=_photo_url(photo.filename),
        ))

    await db.commit()
    return uploaded
