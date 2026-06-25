"""WAJOOD — Pakistan's Unified Missing Persons Platform — FastAPI Application."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.config import settings
from app.database import init_db
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import Request

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("wajood")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("🟢 Starting WAJOOD Platform v%s", settings.APP_VERSION)
    await init_db()
    logger.info("✅ Database tables created")
    # Auto-load seed data on first startup
    from app.seed import run_seed
    await run_seed()
    yield
    logger.info("🔴 Shutting down WAJOOD Platform")


app = FastAPI(
    title="WAJOOD API",
    description="Pakistan's Unified Missing Persons Platform — REST API",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error("Validation error for %s %s: %s", request.method, request.url.path, exc.errors())
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(exc.body)},
    )

# CORS
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
uploads_path = Path(settings.UPLOAD_DIR)
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

# Register routers
from app.routers import auth, cases, persons, matching, organizations, notifications, analytics, websocket  # noqa: E402

app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(persons.router)
app.include_router(matching.router)
app.include_router(organizations.router)
app.include_router(notifications.router)
app.include_router(analytics.router)
app.include_router(websocket.router)


@app.get("/", tags=["Health"])
def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
        "message": "WAJOOD — Pakistan's Unified Missing Persons Platform",
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}
