import json
from browser_use import Agent
from browser_use.llm import ChatDeepSeek, SystemMessage, UserMessage
from pydantic import BaseModel, ValidationError
from common import DEEPSEEK_API_KEY, MAX_CONTEXT_WINDOW
from models.app_models import (
	IntentDomain,
	InvalidIntent,
	ParsedIntent,
	UserQuery,
	UIResponseType, UIBase, FormResponse, MarkdownResponse, UIResponse,
	ChatSessionState, AgentResponse,
)


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
		capped_state = chat_state.ui_states[-MAX_CONTEXT_WINDOW:]

		prompt = f"""
        You are an intent classification engine for an accessible AI browser.
        
        Given the user's query and existing UI state. Your job is to classify the user's request into a ParsedIntent object.
        
        If the user's query is irrelevant to the browser, return an INVALID intent.
        
        Return JSON only. Do not wrap it in markdown.
        
        Schema of the output object:
        {ParsedIntent.model_json_schema()}
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
			return ParsedIntent.model_validate_json(self._extract_json_object(response.completion))
		except (json.JSONDecodeError, ValidationError, ValueError):
			return ParsedIntent(
				domain=IntentDomain.INVALID,
				intent=InvalidIntent(reason="Failed to parse the response.")
			)

	async def submit_form(self, form_element: FormResponse, agent: Agent) -> UIResponse:
		"""Submit a form element to the browser."""
		task = f"""
			You are a form submitter for an accessible web assistant.
			
			Here is the content of the form to fill in:
			{form_element.model_dump_json(indent=2)}
			
			Fill out the form to the best of the your ability. If there is a missing field,
			return a ConversationResponse including the missing field.
			
			{AgentResponse.model_json_schema()}
		"""
		return await self._run_agent_task(task, agent)


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

		recent_ui_state = [
			state.model_dump_json() if isinstance(state, BaseModel) else str(state)
			for state in user_state.ui_states[-MAX_CONTEXT_WINDOW:]
		]

		task = f"""
	        You are controlling a browser for an accessible web assistant.

	        {f'User request: {user_query.query}' if user_query else ''}

	        Parsed intent:
	        {intent.model_dump_json(indent=2)}

	        Recent UI state:
	        {json.dumps(recent_ui_state, indent=2, default=str)}

	        Return JSON only. It must match this schema
	        {AgentResponse.model_json_schema()}
        """
		return await self._run_agent_task(task, agent)

	async def _run_agent_task(
		self, task: str, agent: Agent | None
	) -> UIResponse:
		agent.add_new_task(task)
		result = await agent.run(max_steps=25)
		text_response = result.final_result()
		return AgentResponse.model_validate(self._extract_json_object(text_response)).response

	@staticmethod
	def _latest_form(chat_state: ChatSessionState) -> FormResponse | None:
		for state in reversed(chat_state.ui_states):
			if isinstance(state, FormResponse):
				return state
		return None

	@staticmethod
	def _extract_json_object(text: str) -> str:
		stripped = text.strip()
		if stripped.startswith("```"):
			stripped = stripped.strip("`").strip()
			if stripped.lower().startswith("json"):
				stripped = stripped[4:].strip()

		start = stripped.find("{")
		end = stripped.rfind("}")
		if start == -1 or end == -1 or end <= start:
			raise ValueError("No JSON object found.")

		return stripped[start: end + 1]
