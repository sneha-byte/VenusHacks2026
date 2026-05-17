"""In-process session store when Redis is unavailable (local dev)."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from pydantic import UUID4

from models.app_models import UIBase, UserState


class MemorySessionStore:
	def __init__(self) -> None:
		self._users: dict[str, str] = {}
		self._user_chats: dict[str, dict[str, str]] = {}
		self._chat_messages: dict[str, dict[str, str]] = {}

	async def ping(self) -> bool:
		return True

	async def set_user_session(self, user_state: UserState) -> None:
		self._users[str(user_state.id)] = user_state.model_dump_json()

	async def get_user_session(self, user_id: UUID4) -> UserState | None:
		raw = self._users.get(str(user_id))
		if not raw:
			return None
		return UserState.model_validate_json(raw)

	async def delete_user_session(self, user_id: UUID4) -> bool:
		return self._users.pop(str(user_id), None) is not None

	async def set_chat_session(self, user_id: UUID4, chat_session_id: UUID4) -> None:
		key = str(user_id)
		bucket = self._user_chats.setdefault(key, {})
		bucket[str(chat_session_id)] = str(chat_session_id)

	async def get_chat_sessions(self, user_id: UUID4) -> list[UUID4]:
		bucket = self._user_chats.get(str(user_id), {})
		return [UUID4(sid) for sid in bucket.keys()]

	async def delete_chat_session(self, user_id: UUID4, chat_session_id: UUID4) -> bool:
		bucket = self._user_chats.get(str(user_id), {})
		return bucket.pop(str(chat_session_id), None) is not None

	async def set_chat_message(self, session_id: UUID4, ui_state: UIBase) -> None:
		key = str(session_id)
		bucket = self._chat_messages.setdefault(key, {})
		bucket[str(ui_state.id)] = ui_state.model_dump_json()

	async def get_chat_message(self, session_id: UUID4, message_id: UUID4) -> Any:
		bucket = self._chat_messages.get(str(session_id), {})
		raw = bucket.get(str(message_id))
		if not raw:
			return None
		return json.loads(raw)

	async def get_chat_messages(self, session_id: UUID4) -> list[UIBase] | None:
		bucket = self._chat_messages.get(str(session_id), {})
		if not bucket:
			return None
		return [UIBase.model_validate_json(val) for val in bucket.values()]

	async def delete_chat_messages(self, session_id: UUID4, message_id: UUID4) -> bool:
		bucket = self._chat_messages.get(str(session_id), {})
		return bucket.pop(str(message_id), None) is not None
