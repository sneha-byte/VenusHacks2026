import datetime
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import UUID4

from models.app_models import (
	ChatResponse,
	ChatResponseType,
	ConversationResponse,
	FormResponse,
	FormSubmissionRequest,
	FormUpdateIntent,
	IntentDomain,
	UIResponseType,
	UserQuery,
)
from services.browser_use_service import BrowserUseService
from services.redis_service import redis_service
from services.session_service import session_service
from services.stream_hub import stream_hub

agent_router = APIRouter(prefix="/agent", tags=["Agent"])
browser_use_service = BrowserUseService()


async def _get_form(session_id: UUID4, form_id: UUID4) -> FormResponse:
	form = await redis_service.get_chat_message(session_id, form_id)
	if not isinstance(form, FormResponse):
		raise HTTPException(404, "Form not found in this chat session.")
	return form


def _apply_form_update(form: FormResponse, update: FormUpdateIntent) -> FormResponse:
	"""Merge the field values the user just gave into the stored simplified form."""
	new_values = {field.name: field for field in update.form_field_new_value}
	form.fields = [new_values.get(field.name, field) for field in form.fields]
	return form


@agent_router.post("/chat")
async def chat(request: UserQuery) -> ChatResponse:
	context = session_service.get_session_context(request.session_id)
	if not context:
		raise HTTPException(404, "Chat session not found. Create a message session first.")

	user_message = ConversationResponse(
		id=uuid.uuid4(),
		type=UIResponseType.conversation,
		role="user",
		message=request.query,
		created_at=datetime.datetime.now(datetime.timezone.utc),
	)
	await redis_service.set_chat_message(request.session_id, user_message)
	await stream_hub.publish(request.session_id, "agent_started", query=request.query)

	try:
		chat_state = await redis_service.get_chat_messages(request.session_id)
		parsed_intent = await browser_use_service.infer_user_intent(request, chat_state)
		await stream_hub.publish(request.session_id, "intent", domain=parsed_intent.domain.value)

		if parsed_intent.domain == IntentDomain.APP:
			await stream_hub.publish(request.session_id, "agent_done")
			return ChatResponse(response_type=ChatResponseType.APP_INTENT, response=parsed_intent.intent)

		if parsed_intent.domain == IntentDomain.FORM and isinstance(parsed_intent.intent, FormUpdateIntent):
			form = await _get_form(request.session_id, parsed_intent.intent.form_reference_id)
			form = _apply_form_update(form, parsed_intent.intent)
			await redis_service.set_chat_message(request.session_id, form)
			await stream_hub.publish(request.session_id, "agent_done")
			return ChatResponse(response_type=ChatResponseType.FORM_UPDATE_RESPONSE, response=form)

		ui_state = await browser_use_service.perform_action(
			request, chat_state, parsed_intent, context, session_id=request.session_id,
		)
		await redis_service.set_chat_message(request.session_id, ui_state)
		await stream_hub.publish(request.session_id, "agent_done", response_type=ui_state.type.value)
		return ChatResponse(response_type=ChatResponseType.UI_RESPONSE, response=ui_state)
	except HTTPException:
		await stream_hub.publish(request.session_id, "agent_error", message="Request failed.")
		raise
	except Exception as exc:
		await stream_hub.publish(request.session_id, "agent_error", message=str(exc))
		raise HTTPException(500, "The browser agent failed. Try again.") from exc


@agent_router.post("/submit-form")
async def submit_form(request: FormSubmissionRequest) -> ChatResponse:
	context = session_service.get_session_context(request.session_id)
	if not context:
		raise HTTPException(404, "Chat session not found. Create a message session first.")

	form = await _get_form(request.session_id, request.form_reference_id)
	await stream_hub.publish(request.session_id, "agent_started", query=f"Submit form: {form.title or 'form'}")

	try:
		result = await browser_use_service.submit_form(form, context, session_id=request.session_id)
	except Exception as exc:
		await stream_hub.publish(request.session_id, "agent_error", message=str(exc))
		raise HTTPException(500, "Form submission failed.") from exc

	form.submitted = True
	await redis_service.set_chat_message(request.session_id, form)
	await redis_service.set_chat_message(request.session_id, result)
	await stream_hub.publish(request.session_id, "agent_done", response_type=result.type.value)
	return ChatResponse(response_type=ChatResponseType.UI_RESPONSE, response=result)
