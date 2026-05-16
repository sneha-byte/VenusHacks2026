import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import UUID4

from models.request_models import AgentChatRequest, UserQuery
from models.response_models import ChatSessionState, UIResponse
from services.browser_use_service import BrowserUseService, UI_RESPONSE_ADAPTER
from services.redis_service import redis_service

agent_router = APIRouter(tags=["Agent"])
browser_use_service = BrowserUseService()

async def _get_chat_state(session_id: UUID4) -> ChatSessionState:
    #hgetall returns a dict of {message_id: message_json}, we just want the values (the messages) to reconstruct the chat state.
    raw_messages = await redis_service.redis.hgetall(redis_service._chat_message_key(session_id))
    ui_states = [UI_RESPONSE_ADAPTER.validate_json(message) for message in raw_messages.values()]
    return ChatSessionState(id=session_id, ui_states=ui_states)

# returns a UIResponse that the frontend can render, based on the user's query and the current chat state.
@agent_router.post("/chat")
async def chat(request: AgentChatRequest) -> UIResponse:
    from services.session_service import session_service

    agent = session_service.get_session_agent(request.sessionId)
    if agent is None:
        raise HTTPException(404, "Chat session not found. Create a message session first.")
    # Infer the user's intent based on their query and chat state, perform the action, 
    # get a UI response, save it to Redis, and return it to the frontend.
    user_query = UserQuery(query=request.query)
    chat_state = await _get_chat_state(request.sessionId)
    intent = await browser_use_service.infer_user_intent(user_query, chat_state)
    ui_state = await browser_use_service.perform_action(user_query, chat_state, intent, agent)

    await redis_service.set_chat_message(request.sessionId, ui_state)
    return ui_state
