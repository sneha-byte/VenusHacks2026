import json

from browser_use.llm import ChatDeepSeek, SystemMessage, UserMessage
from browser_use import Agent
from pydantic import ValidationError

from common import DEEPSEEK_API_KEY, MAX_CONTEXT_WINDOW
from models.request_models import UserQuery, ParsedIntent, IntentDomain, WebsiteIntent, InvalidIntent
from models.response_models import FormResponse, ConfirmationResponse, UIBase, ChatSessionState


class BrowserUseService:
    def __init__(self):
        self._llm = ChatDeepSeek(
            api_key=DEEPSEEK_API_KEY
        )

    async def infer_user_intent(
        self,
        user_query: UserQuery,
        chat_state: ChatSessionState,
    ) -> ParsedIntent:
        capped_state = chat_state.ui_states[:MAX_CONTEXT_WINDOW]

        prompt = f"""
        You are an intent classification engine for an accessible AI browser.
        
        Given the user's query and existing UI state. Your job is to classify the user's request into a ParsedIntent object.
        
        If the user's query is irrelevant to the browser, return an INVALID intent.
        
        Schema of the output object:
        {
            ParsedIntent.model_json_schema()
        }
        """

        user_input = f"""
        {user_query.query}
        {capped_state}
        """
        messages = [
	        SystemMessage(role="system", content=prompt),
            UserMessage(role="user", content=user_input),
        ]
        response = await self._llm.ainvoke(messages=messages)

        try:
            parsed_json = json.loads(response.completion)
            return ParsedIntent.model_validate(parsed_json)

        except ValidationError as _:
            return ParsedIntent(
                domain=IntentDomain.INVALID,
	            intent=InvalidIntent(reason="Invalid JSON response from LLM")
            )

    def submit_form(self, form_state: FormResponse, agent: Agent) -> ConfirmationResponse:
        ...

    def perform_action(self, user_query: UserQuery, user_state: ChatSessionState, intent: ParsedIntent,
               agent: Agent) -> UIBase:
        ...
