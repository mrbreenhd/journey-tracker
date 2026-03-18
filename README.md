# Journey Tracker

Road trip tracking app with GPS check-ins, photo uploads, and shareable live maps.

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Create the database
createdb journey_tracker

# Run migrations
alembic upgrade head

# Start the server
uvicorn backend.main:app --reload
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

### Backend (`backend/.env`)
- `DATABASE_URL` — Postgres connection string (async: `postgresql+asyncpg://...`)
- `MAPBOX_TOKEN` — Mapbox access token for reverse geocoding

### Frontend (`frontend/.env`)
- `VITE_MAPBOX_TOKEN` — Mapbox access token for map rendering
- `VITE_API_URL` — Backend API URL (default: `http://localhost:8000`)
