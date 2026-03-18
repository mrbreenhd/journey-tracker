import pathlib

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.routes.trips import router as trips_router

app = FastAPI(title="Journey Tracker", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(trips_router, prefix="/api")

# Serve uploaded photos
upload_path = pathlib.Path(settings.upload_dir)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

# Serve built frontend SPA in production
_frontend_dist = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _frontend_dist.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_frontend_dist / "assets")), name="static")

    @app.get("/{path:path}")
    async def serve_spa(request: Request, path: str):
        """Serve the SPA index.html for all non-API routes."""
        file = _frontend_dist / path
        if file.is_file() and ".." not in path:
            return FileResponse(file)
        return FileResponse(_frontend_dist / "index.html")
