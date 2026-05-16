import redis.asyncio as redis

from common.constants import USER_KEY_PREFIX
from common.constants import CHAT_SESSION_KEY_PREFIX
from common.constants import REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, SESSION_EXPIRATION
from models.response_models import ChatSessionState, UserState


class RedisService:
    def __init__(self):
        self.redis = redis.Redis(
            host=REDIS_HOST,
            port=int(REDIS_PORT),
            password=REDIS_PASSWORD,
            decode_responses=True,
        )

    @staticmethod
    def _user_key(user_id: str) -> str:
        return f"{USER_KEY_PREFIX}:{user_id}"

    @staticmethod
    def _chat_session_key(session_id: str) -> str:
        return f"{CHAT_SESSION_KEY_PREFIX}:{session_id}"
    
    

    # set user session with expiration time, so that we can store user state and chat session state in redis, and retrieve them when needed. 
    # have to serialize the UserState model to json string before storing in redis, and deserialize it back to UserState model when retrieving from redis.
    async def set_user_session(self, user_state: UserState) -> None:
        await self.redis.set(
            self._user_key(str(user_state.id)),
            user_state.model_dump_json(),
            ex=SESSION_EXPIRATION,
        )

    # get user session from redis, if not found, return None. have to parse the json string back to UserState model.
    async def get_user_session(self, user_id: str) -> UserState | None:
        raw_user_state = await self.redis.get(self._user_key(str(user_id)))
        if raw_user_state is None:
            return None

        return UserState.model_validate_json(raw_user_state)

    async def delete_user_session(self, user_id: str) -> bool:
        deleted_count = await self.redis.delete(self._user_key(str(user_id)))
        return deleted_count > 0

    async def set_chat_session(self, chat_session: ChatSessionState) -> None:
        await self.redis.set(
            self._chat_session_key(str(chat_session.id)),
            chat_session.model_dump_json(),
            ex=SESSION_EXPIRATION,
        )

    async def get_chat_session(self, session_id: str) -> ChatSessionState | None:
        raw_chat_session = await self.redis.get(self._chat_session_key(str(session_id)))
        if raw_chat_session is None:
            return None

        return ChatSessionState.model_validate_json(raw_chat_session)

    async def delete_chat_session(self, session_id: str) -> bool:
        deleted_count = await self.redis.delete(self._chat_session_key(str(session_id)))
        return deleted_count > 0
