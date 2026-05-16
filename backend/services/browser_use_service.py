import json
import os
from pathlib import Path
from typing import Any

from pydantic import BaseModel, TypeAdapter, ValidationError

from browser_use import Agent
from browser_use.llm import ChatDeepSeek, SystemMessage, UserMessage

from common import DEEPSEEK_API_KEY, MAX_CONTEXT_WINDOW
from models.request_models import (
    FormUpdateIntent,
    IntentDomain,
    InvalidIntent,
    ParsedIntent,
    UserQuery,
    WebsiteIntent,
)
from models.response_models import (
    ConfirmationResponse,
    FormResponse,
    MarkdownResponse,
    UIBase,
    UIResponse,
    UIResponseType,
    ChatSessionState,
)


UI_RESPONSE_ADAPTER = TypeAdapter(UIResponse)


class BrowserUseService:
    def __init__(self):
        self._llm = ChatDeepSeek(
            api_key=DEEPSEEK_API_KEY
        )

    # infer user intent from their query and return a ParsedIntent object that tells us what the user wants to do.  
    async def infer_user_intent(
        self,
        user_query: UserQuery,
        chat_state: ChatSessionState,
    ) -> ParsedIntent:
        capped_state = chat_state.ui_states[-MAX_CONTEXT_WINDOW:]

        prompt = f"""
        You are an intent classification engine for an accessible AI browser.
        
        Given the user's query and existing UI state. Your job is to classify the user's request into a ParsedIntent object.
        
        If the user's query is irrelevant to the browser, return an INVALID intent.
        
        Return JSON only. Do not wrap it in markdown.
        
        Schema of the output object:
        {
            # inject the ParsedIntent schema here so the LLM knows exactly what fields to return and how to structure them
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
            parsed_json = json.loads(self._extract_json_object(self._llm_text(response)))
            return ParsedIntent.model_validate(parsed_json)
        except (json.JSONDecodeError, ValidationError, ValueError):
            return ParsedIntent(
                domain=IntentDomain.INVALID,
                intent=InvalidIntent(reason="Invalid JSON response from LLM"),
            )

    