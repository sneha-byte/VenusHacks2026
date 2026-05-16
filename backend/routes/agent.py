from fastapi import APIRouter, HTTPException
from models.request_models import UserQuery, IntentDomain
from models.response_models import ChatResponse, ChatResponseType
from services.browser_use_service import BrowserUseService, UI_RESPONSE_ADAPTER
from services.redis_service import redis_service
from services.session_service import session_service

agent_router = APIRouter(tags=["Agent"])
browser_use_service = BrowserUseService()

# returns a UIResponse that the frontend can render, based on the user's query and the current chat state.
@agent_router.post("/chat")
async def chat(request: UserQuery) -> ChatResponse:
    agent = session_service.get_session_agent(request.session_id)
    if agent is None:
        raise HTTPException(404, "Chat session not found. Create a message session first.")
    # Infer the user's intent based on their query and chat state, perform the action, 
    # get a UI response, save it to Redis, and return it to the frontend.
    chat_state = await redis_service.get_chat_messages(request.session_id)
    parsed_intent = await browser_use_service.infer_user_intent(request, chat_state)

    if parsed_intent.domain == IntentDomain.APP and (app_intent := parsed_intent.intent):
        return ChatResponse(response_type=ChatResponseType.APP_INTENT, response=app_intent)

    ui_state = await browser_use_service.perform_action(request, chat_state, parsed_intent, agent)

    await redis_service.set_chat_message(request.session_id, ui_state)
    return ChatResponse(response_type=ChatResponseType.UI_RESPONSE, response=UI_RESPONSE_ADAPTER.dump(ui_state))
