import redis.asyncio as redis

from backend.models.response_models import ChatSessionState, UserState
from backend.models.response_models import UserState
from common.constants import REDIS_PASSWORD, REDIS_PORT, REDIS_HOST

class RedisService:
    def __init__(self):
        self.redis = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            password=REDIS_PASSWORD,
            decode_responses=True,  # Automatically decode bytes to strings
        )
    
    async def set_user_session(self, user_state: UserState):
        await self.redis.set(user_state.id, user_state.model_dump_json(), ex=60*60*24)

    async def get_user_session(self, session_id: str):
        
        ...

    async def set_chat_session(self, chat_session: ChatSessionState):
        
    async def get_chat_session(self, session_id: str):
        
      
