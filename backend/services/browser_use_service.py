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


# This adapter is specifically for UIResponse because UIResponse is not one
# single class. It is a union of possible frontend states: form, markdown, list,
# conversation, or confirmation. The adapter lets us parse JSON and have Pydantic
# choose the right concrete response model from the "type" field.
UI_RESPONSE_ADAPTER = TypeAdapter(UIResponse)


class BrowserUseService:
    def __init__(self):
        # DeepSeek is the reasoning model. We use it directly for intent parsing,
        # and browser-use also uses it to decide how to interact with websites.
        self._llm = ChatDeepSeek(
            api_key=DEEPSEEK_API_KEY
        )

    # infer user intent from their query and return a ParsedIntent object that tells us what the user wants to do.  
    async def infer_user_intent(
        self,
        user_query: UserQuery,
        chat_state: ChatSessionState,
    ) -> ParsedIntent:
        # The chat state can grow over time. We only include the most recent UI
        # states so the LLM has enough context without getting a huge prompt.
        capped_state = chat_state.ui_states[-MAX_CONTEXT_WINDOW:]

        # This prompt does not ask the LLM to browse yet. It only asks:
        # "What kind of action is the user asking for?"
        # That keeps classification separate from execution.
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
            # The LLM may return valid JSON, or it may return JSON surrounded by
            # text. _extract_json_object strips the extra text before validation.
            parsed_json = json.loads(self._extract_json_object(self._llm_text(response)))
            # model_validate turns the raw dict into your strongly typed ParsedIntent.
            return ParsedIntent.model_validate(parsed_json)
        except (json.JSONDecodeError, ValidationError, ValueError):
            # Instead of crashing when the LLM response is malformed, we return
            # a normal INVALID intent that the rest of the backend can handle.
            return ParsedIntent(
                domain=IntentDomain.INVALID,
                intent=InvalidIntent(reason="Invalid JSON response from LLM"),
            )

    # submit the currently displayed simplified form with browser-use, and return a ConfirmationResponse that tells us whether the submission was successful or not, and any relevant details.
    async def submit_form(self, form_state: FormResponse, agent: Agent) -> ConfirmationResponse:
        """Submit the currently displayed simplified form with browser-use."""
        # form_state is our simplified version of the website form. The agent's
        # job is to map these simplified fields back onto the real website UI.
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
        # browser-use returns a history object, so we extract the useful final
        # text before trying to turn it into a ConfirmationResponse.
        text = self._history_text(history)

        try:
            # Best case: the agent returns JSON matching ConfirmationResponse.
            return ConfirmationResponse.model_validate_json(self._extract_json_object(text))
        except (json.JSONDecodeError, ValidationError, ValueError):
            # Fallback: if the browser agent gives natural language instead of
            # JSON, still show it to the user inside a confirmation UI.
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
        # INVALID means the classifier could not understand the request as
        # something our browser/app/form system can safely do.
        if intent.domain == IntentDomain.INVALID:
            reason = getattr(intent.intent, "reason", "I could not understand that request.")
            return MarkdownResponse(type=UIResponseType.markdown, content=reason)

        # APP intents are things like app settings or conversations. Browser-use
        # should not handle those because they are part of our app, not the website.
        if intent.domain == IntentDomain.APP:
            return MarkdownResponse(
                type=UIResponseType.markdown,
                content="That is an app-level action. The session service should handle it outside browser-use.",
            )

        # FORM means the user is talking about a simplified form we already have
        # in chat_state, such as "submit this" or "change the date".
        if intent.domain == IntentDomain.FORM:
            return await self._perform_form_action(user_query, user_state, intent, agent)

        # Any other valid intent is treated as a website action: navigate, click,
        # search, extract content, or discover a form from the page.
        return await self._perform_website_action(user_query, user_state, intent, agent)

    # submit the currently displayed simplified form with browser-use, and return a ConfirmationResponse that tells us whether the submission was successful or not, and any relevant details.
    async def _perform_form_action(
        self,
        user_query: UserQuery,
        chat_state: ChatSessionState,
        intent: ParsedIntent,
        agent: Agent | None,
    ) -> UIResponse:
        # Find the form currently being displayed to the user. This lets the
        # backend connect natural language like "submit it" to the right form.
        current_form = self._latest_form(chat_state)
        if current_form is None:
            return MarkdownResponse(
                type=UIResponseType.markdown,
                content="I do not see a simplified form in the current session yet.",
            )

        # If the parsed intent is submit, hand off to the dedicated submit flow.
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
        # For website interactions, browser-use does the actual page inspection
        # or interaction, then we ask it to return simplified UI JSON.
        task = self._build_ui_extraction_task(user_query, chat_state, intent)
        return await self._run_and_parse_ui_response(task, agent)

    # run a browser use agent to perform action then extract resulting ui state from output and parse it into ui response object for frontend 
    async def _run_and_parse_ui_response(self, task: str, agent: Agent | None) -> UIResponse:
        # Run the agent first. The output is not immediately a UI model; it is
        # browser-use history, which we convert to text and then validate.
        history = await self._run_agent_task(task, agent)
        text = self._history_text(history)

        try:
            # Validate the JSON into the correct UIResponse subtype. For example,
            # a {"type": "form", ...} object becomes a FormResponse.
            return UI_RESPONSE_ADAPTER.validate_json(self._extract_json_object(text))
        except (json.JSONDecodeError, ValidationError, ValueError):
            # If structured parsing fails, return markdown so the user still sees
            # the agent's result instead of getting an error.
            return MarkdownResponse(
                type=UIResponseType.markdown,
                content=text or "I finished the browser action, but could not convert the result into UI state.",
            )

    # run agent task and return the final result or extracted content as text 
    async def _run_agent_task(self, task: str, agent: Agent | None) -> Any:
        # This assumes the caller gives us an existing browser-use Agent tied to
        # the user's browser session. add_new_task keeps the browser context alive.
        agent.add_new_task(task)
        agent.output_model_schema
        # max_steps prevents the browser-use agent from running forever.
        return await agent.run(max_steps=25)

    # instruction for browser use says to use browser to satisfy the parsed intent, and extract resulting ui state into a UIResponse object for 
    # frontend to render 
    def _build_ui_extraction_task(
        self,
        user_query: UserQuery,
        chat_state: ChatSessionState,
        intent: ParsedIntent,
    ) -> str:
        # The agent sees recent UI state so it knows what the frontend currently
        # displays and can return the next simplified state.
        recent_ui_state = [
            state.model_dump_json() if isinstance(state, BaseModel) else str(state)
            for state in chat_state.ui_states[-MAX_CONTEXT_WINDOW:]
        ]

        # This is the main "website -> simplified UI" instruction. It tells
        # browser-use to interact with the page, then return one of our UI models.
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

    @staticmethod
    def _latest_form(chat_state: ChatSessionState) -> FormResponse | None:
        # get most recent form response from chat state 
        for state in reversed(chat_state.ui_states):
            if isinstance(state, FormResponse):
                return state
        return None

    @staticmethod
    def _history_text(history: Any) -> str:
        # AgentHistoryList.final_result() is the clean final answer when available.
        if history is None:
            return ""

        final_result = history.final_result() if hasattr(history, "final_result") else None
        if final_result:
            return str(final_result)

        # If there is no single final result, combine extracted content from steps.
        extracted = history.extracted_content() if hasattr(history, "extracted_content") else []
        return "\n\n".join(str(item) for item in extracted if item)

    @staticmethod
    def _llm_text(response: Any) -> str:
        # Different LLM wrappers expose response text differently. This supports
        # the common names without tying the code to one response shape.
        return str(
            getattr(response, "completion", None)
            or getattr(response, "content", None)
            or response
        )

    @staticmethod
    def _extract_json_object(text: str) -> str:
        # LLMs often wrap JSON in markdown fences or explanation. This function
        # pulls out the first complete-looking JSON object for Pydantic to parse.
        stripped = text.strip()
        if stripped.startswith("```"):
            stripped = stripped.strip("`").strip()
            if stripped.lower().startswith("json"):
                stripped = stripped[4:].strip()

        start = stripped.find("{")
        end = stripped.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("No JSON object found.")

        return stripped[start : end + 1]
