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

    # submit the currently displayed simplified form with browser-use, and return a ConfirmationResponse that tells us whether the submission was successful or not, and any relevant details.
    async def submit_form(self, form_state: FormResponse, agent: Agent) -> ConfirmationResponse:
        """Submit the currently displayed simplified form with browser-use."""
        task = f"""
        Submit the currently active website form using these simplified form values.

        Form state:
        {form_state.model_dump_json(indent=2)}

        Rules:
        - Use the actual website UI; do not invent a submission.
        - If a required value is missing, stop and explain what is missing.
        - Return JSON only matching this shape:
        {ConfirmationResponse.model_json_schema()}
        """

        history = await self._run_agent_task(task, agent)
        text = self._history_text(history)

        try:
            return ConfirmationResponse.model_validate_json(self._extract_json_object(text))
        except (json.JSONDecodeError, ValidationError, ValueError):
            return ConfirmationResponse(
                type=UIResponseType.confirmation,
                title="Form submission status",
                message=text or "The form submission finished, but no confirmation details were returned.",
            )

    # perform the user's intended action in the browser, and return a UIResponse that represents the new state of the UI after performing the action. This will be sent to the frontend to update what the user sees.
    async def perform_action(
        self,
        user_query: UserQuery,
        user_state: ChatSessionState,
        intent: ParsedIntent,
        agent: Agent,
    ) -> UIBase:
        """Run the parsed browser/form intent and return UI state for the frontend."""
        if intent.domain == IntentDomain.INVALID:
            reason = getattr(intent.intent, "reason", "I could not understand that request.")
            return MarkdownResponse(type=UIResponseType.markdown, content=reason)

        if intent.domain == IntentDomain.APP:
            return MarkdownResponse(
                type=UIResponseType.markdown,
                content="That is an app-level action. The session service should handle it outside browser-use.",
            )

        if intent.domain == IntentDomain.FORM:
            return await self._perform_form_action(user_query, user_state, intent, agent)

        return await self._perform_website_action(user_query, user_state, intent, agent)

    # submit the currently displayed simplified form with browser-use, and return a ConfirmationResponse that tells us whether the submission was successful or not, and any relevant details.
    async def _perform_form_action(
        self,
        user_query: UserQuery,
        chat_state: ChatSessionState,
        intent: ParsedIntent,
        agent: Agent | None,
    ) -> UIResponse:
        current_form = self._latest_form(chat_state)
        if current_form is None:
            return MarkdownResponse(
                type=UIResponseType.markdown,
                content="I do not see a simplified form in the current session yet.",
            )

        if isinstance(intent.intent, WebsiteIntent) and intent.intent == WebsiteIntent.SUBMIT:
            return await self.submit_form(current_form, agent)

        if isinstance(intent.intent, FormUpdateIntent):
            # The current FormUpdateIntent model tells us which field types changed,
            # but it does not carry the actual target field name or new value yet.
            # Ask the browser agent to infer the change from the user's natural language.
            task = self._build_ui_extraction_task(user_query, chat_state, intent)
            return await self._run_and_parse_ui_response(task, agent)

        return MarkdownResponse(
            type=UIResponseType.markdown,
            content="I found the current form, but the parsed intent does not include enough detail to update it.",
        )

    # perform a website interaction based on the user's intent, and return the resulting UI state as a UIResponse for the frontend to render.
    async def _perform_website_action(
        self,
        user_query: UserQuery,
        chat_state: ChatSessionState,
        intent: ParsedIntent,
        agent: Agent | None,
    ) -> UIResponse:
        task = self._build_ui_extraction_task(user_query, chat_state, intent)
        return await self._run_and_parse_ui_response(task, agent)

    # run a browser use agent to perform action then extract resulting ui state from output and parse it into ui response object for frontend 
    async def _run_and_parse_ui_response(self, task: str, agent: Agent | None) -> UIResponse:
        history = await self._run_agent_task(task, agent)
        text = self._history_text(history)

        try:
            return UI_RESPONSE_ADAPTER.validate_json(self._extract_json_object(text))
        except (json.JSONDecodeError, ValidationError, ValueError):
            return MarkdownResponse(
                type=UIResponseType.markdown,
                content=text or "I finished the browser action, but could not convert the result into UI state.",
            )

    # run agent task and return the final result or extracted content as text 
    async def _run_agent_task(self, task: str, agent: Agent | None) -> Any:
        agent.add_new_task(task)
        agent.output_model_schema
        return await agent.run(max_steps=25)

    # instruction for browser use says to use browser to satisfy the parsed intent, and extract resulting ui state into a UIResponse object for 
    # frontend to render 
    def _build_ui_extraction_task(
        self,
        user_query: UserQuery,
        chat_state: ChatSessionState,
        intent: ParsedIntent,
    ) -> str:
        recent_ui_state = [
            state.model_dump_json() if isinstance(state, BaseModel) else str(state)
            for state in chat_state.ui_states[-MAX_CONTEXT_WINDOW:]
        ]

        return f"""
        You are controlling a browser for an accessible web assistant.

        User request:
        {user_query.query}

        Parsed intent:
        {intent.model_dump_json(indent=2)}

        Recent UI state:
        {json.dumps(recent_ui_state, indent=2, default=str)}

        Your job:
        1. Use the browser to satisfy the parsed intent.
        2. If the page contains a form the user needs to fill, extract it as a FormResponse.
        3. If the page contains options/results, extract them as a ListResponse.
        4. If the page contains explanatory information, summarize it as a MarkdownResponse.
        5. If you submitted something, return a ConfirmationResponse.

        Return JSON only. It must match one member of this UIResponse schema:
        {json.dumps(UI_RESPONSE_ADAPTER.json_schema(), indent=2)}
        """

    