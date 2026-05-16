from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models.response_models import AnalyzeResponse
from services import cache_service
from common.constants import ALLOWED_ORIGINS
from routes.analyze import router as analyze_router


load_dotenv()

app = FastAPI(
    title="ClearPath API",
    description="Backend AI orchestration layer for the ClearPath Chrome Extension.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

app.include_router(analyze_router)


@app.get("/health")
async def health() -> dict[str, str]:
    # Tiny endpoint for checking that the backend is running.
    return {"status": "ok"}


