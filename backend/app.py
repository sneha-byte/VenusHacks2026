import asyncio
import sys

# Playwright needs subprocess support on Windows (uvicorn defaults to Selector loop).
if sys.platform == "win32":
	asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from common.constants import ALLOWED_ORIGINS
from routes.agent import agent_router
from routes.sandbox import sandbox_router
from routes.sessions import session_router
from services.session_service import session_service

load_dotenv()

_cors_origins = [o.strip() for o in ALLOWED_ORIGINS if o and o.strip()]
if not _cors_origins:
	_cors_origins = ["http://localhost:5173"]


@asynccontextmanager
async def lifespan(_):
	try:
		await session_service.start()
	except Exception as exc:
		print(f"Warning: browser agent not started ({exc}).")
		print(
			"Form auto-submit needs a browser: install Chrome, or run "
			"`python -m playwright install chromium` in the backend folder."
		)
	yield
	try:
		await session_service.stop()
	except Exception:
		pass


app = FastAPI(
	title="Browzen API",
	description="Backend AI orchestration layer for Browzen.",
	version="0.1.0",
	lifespan=lifespan,
)

app.add_middleware(
	CORSMiddleware,
	allow_origins=_cors_origins,
	allow_credentials=False,
	allow_methods=["*"],
	allow_headers=["*"],
)

app.include_router(session_router)
app.include_router(agent_router)
app.include_router(sandbox_router)


@app.get("/health")
async def health() -> dict[str, str]:
	return {"status": "ok"}
