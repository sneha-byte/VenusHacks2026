import uuid
from typing import List

from fastapi import APIRouter, HTTPException, Query
from pydantic import UUID4

from models.request_models import UpdateSessionStateRequest, UpdateUserStateRequest
from models.response_models import UserState, ChatSessionState, UIBase, GetChatDetailsResponse
from services.redis_service import redis_service
from services.session_service import session_service

session_router = APIRouter(prefix="/session", tags=["Sessions"])


async def _append_chat_session_to_user(user_session_id: UUID4, chat_session_id: UUID4) -> None:
	user = await redis_service.get_user_session(user_session_id)
	if user is None:
		raise HTTPException(404, "User not found")
	if chat_session_id not in user.chat_session_ids:
		user.chat_session_ids.append(chat_session_id)
		await redis_service.set_user_session(user)


@session_router.get("/")
async def get_user_session(
	session_id: UUID4 = Query(..., description="User session id"),
) -> UserState:
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
async def delete_user_session(
	user_session_id: UUID4 = Query(..., description="User session id"),
) -> bool:
	user_session = await redis_service.get_user_session(user_session_id)
	if user_session is None:
		raise HTTPException(404, "User not found")

	for chat_session_id in user_session.chat_session_ids:
		await redis_service.delete_chat_messages(chat_session_id)
		await redis_service.delete_chat_session(user_session_id, chat_session_id)
		try:
			await session_service.expire_session(chat_session_id)
		except Exception:
			pass

	await redis_service.delete_user_session(user_session_id)
	return True


@session_router.get("/message-sessions")
async def get_message_sessions(
	user_session_id: UUID4 = Query(..., description="User session id"),
) -> List[UUID4]:
	return await redis_service.get_chat_sessions(user_session_id)


@session_router.post("/create-message-session")
async def create_message_session(
	user_session_id: UUID4 = Query(..., description="User session id"),
) -> ChatSessionState:
	try:
		new_session_id = await session_service.create_new_session()
	except Exception:
		new_session_id = uuid.uuid4()

	await redis_service.set_chat_session(user_session_id, new_session_id)
	await _append_chat_session_to_user(user_session_id, new_session_id)
	return ChatSessionState(id=new_session_id)


@session_router.delete("/delete-message-session")
async def delete_message_session(
	user_session_id: UUID4 = Query(..., description="User session id"),
	chat_session_id: UUID4 = Query(..., description="Chat session id"),
) -> bool:
	await redis_service.delete_chat_messages(chat_session_id)
	await redis_service.delete_chat_session(user_session_id, chat_session_id)
	try:
		await session_service.expire_session(chat_session_id)
	except Exception:
		pass

	user = await redis_service.get_user_session(user_session_id)
	if user is not None:
		user.chat_session_ids = [sid for sid in user.chat_session_ids if sid != chat_session_id]
		await redis_service.set_user_session(user)

	return True


@session_router.post("/update-message-session")
async def update_message_session(request: UpdateSessionStateRequest):
	await redis_service.set_chat_message(request.session_id, request.new_ui_state)
	return request.new_ui_state


@session_router.get("/chat-session-detail")
async def get_message_details(
	session_id: UUID4 = Query(..., description="Chat session id"),
) -> GetChatDetailsResponse:
	session_context = session_service.get_session_context(session_id)
	pages = [
		page.url for page in session_context.pages
	]

	messages = await redis_service.get_chat_messages(session_id)
	return GetChatDetailsResponse(page_urls=pages, chat_session_states=messages)
