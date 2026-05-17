from typing import List

import redis.asyncio as redis
from pydantic import UUID4

from common.constants import REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, SESSION_EXPIRATION
from models.app_models import UIBase, UserState, UIResponse
from services.memory_session_store import MemorySessionStore

USER_KEY_PREFIX = "user"
CHAT_SESSION_KEY_PREFIX = "chat_session"
CHAT_MESSAGE_KEY_PREFIX = "chat_message"


class RedisService:
	def __init__(self):
		self._memory = MemorySessionStore()
		self._use_memory = False
		self.redis: redis.Redis | None = redis.Redis(
			host=REDIS_HOST,
			port=int(REDIS_PORT or 6379),
			password=REDIS_PASSWORD,
			decode_responses=True,
		)

	async def _backend(self):
		if self._use_memory:
			return self._memory
		try:
			await self.redis.ping()  # type: ignore[union-attr]
			return self.redis
		except Exception:
			self._use_memory = True
			print("Redis unavailable — using in-memory session store for local dev.")
			return self._memory

	@staticmethod
	def _user_key(user_id: UUID4) -> str:
		return f"{USER_KEY_PREFIX}:{str(user_id)}"

	@staticmethod
	def _user_chat_session_key(user_id: UUID4) -> str:
		return f"{CHAT_SESSION_KEY_PREFIX}:{str(user_id)}"

	@staticmethod
	def _chat_message_key(session_id: UUID4) -> str:
		return f"{CHAT_MESSAGE_KEY_PREFIX}:{str(session_id)}"

	@staticmethod
	def _chat_session_ui_state_field(ui_state_id: UUID4) -> str:
		return str(ui_state_id)

	async def set_user_session(self, user_state: UserState) -> None:
		backend = await self._backend()
		if backend is self._memory:
			await backend.set_user_session(user_state)
			return
		await backend.set(
			self._user_key(user_state.id),
			user_state.model_dump_json(),
			ex=SESSION_EXPIRATION,
		)

	async def get_user_session(self, user_id: UUID4) -> UserState | None:
		backend = await self._backend()
		if backend is self._memory:
			return await backend.get_user_session(user_id)
		raw_user_state = await backend.get(self._user_key(user_id))
		if not raw_user_state:
			return None
		return UserState.model_validate_json(raw_user_state)

	async def delete_user_session(self, user_id: UUID4) -> bool:
		backend = await self._backend()
		if backend is self._memory:
			return await backend.delete_user_session(user_id)
		deleted_count = await backend.delete(self._user_key(user_id))
		return deleted_count > 0

	async def set_chat_session(self, user_id: UUID4, chat_session_id: UUID4) -> None:
		backend = await self._backend()
		if backend is self._memory:
			await backend.set_chat_session(user_id, chat_session_id)
			return
		await backend.hset(
			self._user_chat_session_key(user_id),
			str(chat_session_id),
			str(chat_session_id),
		)
		await backend.expire(self._user_chat_session_key(user_id), SESSION_EXPIRATION)

	async def get_chat_sessions(self, user_id: UUID4) -> list[UUID4]:
		backend = await self._backend()
		if backend is self._memory:
			return await backend.get_chat_sessions(user_id)
		result = await backend.hgetall(self._user_chat_session_key(user_id))
		return [UUID4(session_id) for session_id in result.keys()]

	async def delete_chat_session(self, user_id: UUID4, chat_session_id: UUID4) -> bool:
		backend = await self._backend()
		if backend is self._memory:
			return await backend.delete_chat_session(user_id, chat_session_id)
		deleted_count = await backend.hdel(
			self._user_chat_session_key(user_id), str(chat_session_id)
		)
		return deleted_count > 0

	async def set_chat_message(self, session_id: UUID4, ui_state: UIBase) -> None:
		backend = await self._backend()
		if backend is self._memory:
			await backend.set_chat_message(session_id, ui_state)
			return
		await backend.hset(
			self._chat_message_key(session_id),
			str(ui_state.id),
			value=ui_state.model_dump_json(),
		)
		await backend.expire(self._chat_message_key(session_id), SESSION_EXPIRATION)

	async def get_chat_message(self, session_id: UUID4, message_id: UUID4) -> UIResponse | None:
		backend = await self._backend()
		if backend is self._memory:
			raw = await backend.get_chat_message(session_id, message_id)
			return UIResponse.model_validate(raw) if raw else None
		raw = await backend.hget(self._chat_message_key(session_id), str(message_id))
		if not raw:
			return None
		return UIResponse.model_validate_json(raw)

	async def get_chat_messages(self, session_id: UUID4) -> List[UIBase] | None:
		backend = await self._backend()
		if backend is self._memory:
			return await backend.get_chat_messages(session_id)
		raw_chat_session = await backend.hgetall(self._chat_message_key(session_id))
		if not raw_chat_session:
			return None
		messages = []
		for val in raw_chat_session.values():
			messages.append(UIBase.model_validate_json(val))
		return messages

	async def delete_chat_messages(self, session_id: UUID4, message_id: UUID4) -> bool:
		backend = await self._backend()
		if backend is self._memory:
			return await backend.delete_chat_messages(session_id, message_id)
		deleted_count = await backend.hdel(
			self._chat_message_key(session_id),
			self._chat_session_ui_state_field(message_id),
		)
		return deleted_count > 0


redis_service = RedisService()
