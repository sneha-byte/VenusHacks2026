import json
import uuid
from typing import List

from browser_use import Agent
from browser_use.llm import ChatDeepSeek, SystemMessage, UserMessage
from playwright.async_api import BrowserContext
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
		chat_state: List[UIResponse] | None,
	) -> ParsedIntent:

		prompt = f"""
        You are an intent classification engine for an accessible AI browser.
        
        Given the user's query and existing UI state. Your job is to classify the user's request into a ParsedIntent object.
        
        If the user's query is irrelevant to the browser, return an INVALID intent.
        
        Only return the type="FORM" for the intent domain if the user's is trying to fill in information
        on a form that exists in the UI state. If the user's trying to find a form, return the type="website" intent.
        """

		user_input = f"""
        {user_query.query}
        {chat_state[-MAX_CONTEXT_WINDOW:] if chat_state else []}
        """
		messages = [
			SystemMessage(role="system", content=prompt),
			UserMessage(role="user", content=user_input),
		]

		response = await self._llm.ainvoke(messages=messages, output_format=ParsedIntent)
		try:
			return ParsedIntent.model_validate(response.completion)
		except (json.JSONDecodeError, ValidationError, ValueError):
			return ParsedIntent(
				domain=IntentDomain.INVALID,
				intent=InvalidIntent(reason="Failed to parse the response.")
			)

	async def submit_form(self, form_element: FormResponse, context: BrowserContext) -> UIResponse:
		"""Submit a form element to the browser."""
		task = f"""
			You are a form submitter for an accessible web assistant.
			
			Here is the content of the form to fill in:
			{form_element.model_dump_json(indent=2)}
			
			Fill out the form to the best of the your ability. If there is a missing field,
			return a ConversationResponse including the missing field.
			
		"""
		return await self._run_agent_task(task, context)


	async def perform_action(
		self,
		user_query: UserQuery,
		messages: List[UIResponse],
		intent: ParsedIntent,
		context: BrowserContext
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


		task = f"""
	        You are controlling a browser for an accessible web assistant.

	        {f'User request: {user_query.query}' if user_query else ''}
	        

	        Parsed intent:
	        {intent.model_dump_json(indent=2)}

	        Recent UI state:
	        {messages[-MAX_CONTEXT_WINDOW:] if messages else []}
	        
	        Actions:
	        1. Navigate to the relevant websites. If you are not sure which website to navigate to, return a ConversationResponse.
	        2. Perform the relevant actions on the website.

        """
		return await self._run_agent_task(task, context)

	async def _run_agent_task(
		self, task: str, context: BrowserContext
	) -> UIResponse:
		agent = Agent(
			llm=self._llm,
			context=context,
			task=task,
			output_model_schema=AgentResponse,
		)
		result = await agent.run(max_steps=25)
		response_object = AgentResponse.model_validate(result.structured_output).response
		response_object.id = uuid.uuid4()
		return response_object

	@staticmethod
	def _latest_form(chat_state: ChatSessionState) -> FormResponse | None:
		for state in reversed(chat_state.ui_states):
			if isinstance(state, FormResponse):
				return state
		return None
