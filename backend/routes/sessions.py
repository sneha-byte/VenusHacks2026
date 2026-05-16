import uuid
from typing import List

from fastapi import APIRouter, HTTPException
from fastapi.websockets import WebSocket
from pydantic import UUID4
from models.request_models import UpdateSessionStateRequest, UpdateUserStateRequest
from models.response_models import UserState, ChatSessionState
from services.redis_service import redis_service
from services.session_service import session_service

session_router = APIRouter(prefix="/session", tags=["Sessions"])


@session_router.get("/")
async def get_sessions(session_id: UUID4) -> UserState:
	result = await redis_service.get_user_session(session_id)
	if result is None:
		raise HTTPException(404, "User not found")
	return result


@session_router.post("/create-user-session")
async def create_user_session() -> UserState:
	new_user_session_id = uuid.uuid4()
	user_session = UserState(id=new_user_session_id)
	await redis_service.set_user_session(user_session)
	return user_session


@session_router.post("/update-user-session")
async def update_user_session(request: UpdateUserStateRequest) -> UserState:
	await redis_service.set_user_session(request.new_user_state)
	return request.new_user_state


@session_router.delete("/delete-user-session")
async def delete_user_session(user_session_id: UUID4) -> bool:
	user_session = await redis_service.get_user_session(user_session_id)
	if user_session is None:
		raise HTTPException(404, "User not found")

	for chat_session_id in user_session.chat_sessions:
		await redis_service.delete_chat_session(user_session_id, chat_session_id)
		await redis_service.delete_chat_messages(chat_session_id)

	await redis_service.delete_user_session(user_session_id)

	return True


@session_router.get("/message-sessions")
async def get_message_sessions(user_session_id: UUID4) -> List[UUID4]:
	return await redis_service.get_chat_sessions(user_session_id)


@session_router.post("/create-message-session")
async def create_session(user_session_id: UUID4) -> ChatSessionState:
	new_session_id = await session_service.create_new_session()
	await redis_service.set_chat_session(user_session_id, new_session_id)
	return ChatSessionState(id=new_session_id)

@session_router.delete("/delete-message-session")
async def delete_session(user_session_id: UUID4, chat_session_id: UUID4) -> bool:
	await redis_service.delete_chat_messages(chat_session_id)
	await redis_service.delete_chat_session(user_session_id, chat_session_id)
	await session_service.delete_session(chat_session_id)
	return True

@session_router.post("/update-message-session")
async def update_session(request: UpdateSessionStateRequest):
	...


@session_router.websocket("/session_ws")
async def session_ws():
	...