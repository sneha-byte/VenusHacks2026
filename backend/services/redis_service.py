import redis.asyncio as redis
from pydantic import UUID4

from common.constants import REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, SESSION_EXPIRATION
from models.response_models import ChatSessionState, UserState


USER_KEY_PREFIX = "user"
CHAT_SESSION_KEY_PREFIX = "chat_session"
CHAT_SESSION_


class RedisService:
    def __init__(self):
        self.redis = redis.Redis(
            host=REDIS_HOST,
            port=int(REDIS_PORT or 6379),
            password=REDIS_PASSWORD,
            decode_responses=True,
        )

    @staticmethod
    def _user_key(user_id: UUID4) -> str:
        return f"{USER_KEY_PREFIX}:{str(user_id)}"

    @staticmethod
    def _user_chat_session_key(user_id: UUID4) -> str:
        return f"{CHAT_SESSION_KEY_PREFIX}:{str(user_id)}"

    @staticmethod
    def _chat_session_key(session_id: UUID4) -> str:
        return f"{CHAT_SESSION_KEY_PREFIX}:{str(session_id)}"

    @staticmethod
    def _chat_session_ui_state_field(ui_state_id: UUID4) -> str:
        return str(ui_state_id)


    async def set_user_session(self, user_state: UserState) -> None:
        await self.redis.set(
            self._user_key(user_state.id),
            user_state.model_dump_json(exclude={"chat_sessions"}),
            ex=SESSION_EXPIRATION,
        )

    async def get_user_session(self, user_id: UUID4) -> UserState | None:
        raw_user_state = await self.redis.get(self._user_key(user_id))
        if raw_user_state is None:
            return None

        return UserState.model_validate_json(raw_user_state)

    async def delete_user_session(self, user_id: UUID4) -> bool:
        deleted_count = await self.redis.delete(self._user_key(user_id))
        return deleted_count > 0

    async def set_chat_session(self, user_id: UUID4, chat_session_id: UUID4) -> None:
        await self.redis.hset(
            self._user_chat_session_key(user_id),
            str(chat_session_id),
        )

    async def set_chat_session_ui_state(self, session_id: UUID4, ui_state: ChatSessionState) -> None:
        await self.redis.hset(
            self._user_chat_session_key(session_id),
            ui_state.id.hex,
            ui_state.model_dump_json(),
        )

    async def get_chat_session(self, session_id: UUID4) -> ChatSessionState | None:
        raw_chat_session = await self.redis.hgetall(self._user_chat_session_key(session_id))
        if raw_chat_session is None:
            return None

        # return ChatSessionState.model_validate_json(raw_chat_session)

    async def delete_chat_session(self, session_id: UUID4) -> bool:
        deleted_count = await self.redis.hdel(self._user_chat_session_key(session_id))
        return deleted_count > 0
