from fastapi import APIRouter
from fastapi.websockets import WebSocket

from models.response_models import UserState, ChatSessionState

session_router = APIRouter(prefix="/session", tags=["Sessions"])


@session_router.get("/")
async def get_sessions() -> UserState:
	...


@session_router.get("/session")
async def get_session() -> ChatSessionState:
	return {"session_id": "12345"}


@session_router.post("/update_session")
async def update_session():
	...


@session_router.delete("/delete_session")
async def delete_sessions():
	...


@session_router.websocket("/session_ws")
async def session_ws():
	...