import asyncio
import hashlib
import re

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from pydantic import UUID4, BaseModel

from models.sandbox_models import BrowserPageInfo, SandboxPagesResponse
from services.google_form_fill import fill_uci_post_course_form
from services.redis_service import redis_service
from services.session_service import session_service
from services.stream_hub import stream_hub

# ~2 fps is plenty for watching an agent click through a form, and unchanged
# frames are skipped, so an idle page costs almost nothing.
FRAME_INTERVAL_SECONDS = 0.5
FRAME_JPEG_QUALITY = 60

sandbox_router = APIRouter(prefix="/sandbox", tags=["Sandbox"])

_URL_RE = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)


class BrowserEventRequest(BaseModel):
	type: str
	sessionId: UUID4
	targetId: str | None = None
	payload: dict | None = None


class FillUciFormRequest(BaseModel):
	sessionId: UUID4
	answers: dict[str, str]


@sandbox_router.get("/pages/{session_id}", response_model=SandboxPagesResponse)
async def list_sandbox_pages(session_id: UUID4) -> SandboxPagesResponse:
	if not session_service.has_session(session_id):
		return SandboxPagesResponse(pages=[], active_page_id=None)

	metas, active_id = await session_service.list_pages(session_id)
	return SandboxPagesResponse(
		pages=[
			BrowserPageInfo(
				id=m.id,
				title=m.title,
				url=m.url,
				is_active=m.id == active_id,
			)
			for m in metas
		],
		active_page_id=active_id,
	)


@sandbox_router.get("/stream/{session_id}")
async def stream_active_page(session_id: UUID4) -> Response:
	if not session_service.has_session(session_id):
		raise HTTPException(404, "Session not found or browser not running")

	try:
		png = await session_service.screenshot_active_page(session_id)
	except KeyError:
		raise HTTPException(404, "No active page to stream")

	return Response(
		content=png,
		media_type="image/png",
		headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
	)


@sandbox_router.websocket("/ws/{session_id}")
async def sandbox_socket(websocket: WebSocket, session_id: UUID4, frames: bool = True) -> None:
	"""Live channel for one chat session.

	Server -> client:
	  * binary messages: JPEG frames of the active page (sent only when the frame changes)
	  * text messages: JSON agent events (agent_started, intent, agent_step, agent_done, agent_error)
	    plus one {"type": "replay", "events": [...]} right after connecting, read from Redis,
	    so a client that reconnects mid-run catches up on what it missed.
	Client -> server: {"type": "pause"} / {"type": "resume"} to stop or restart frames.
	Connect with ?frames=false to get only agent events (e.g. the chat's progress strip).
	"""
	await websocket.accept()
	queue = stream_hub.subscribe(session_id)
	paused = asyncio.Event()

	async def send_frames() -> None:
		last_digest = None
		while True:
			if not paused.is_set() and session_service.has_session(session_id):
				try:
					frame = await session_service.screenshot_active_page(
						session_id, image_type="jpeg", quality=FRAME_JPEG_QUALITY,
					)
				except Exception:
					frame = None
				if frame is not None:
					digest = hashlib.blake2b(frame, digest_size=16).digest()
					if digest != last_digest:
						await websocket.send_bytes(frame)
						last_digest = digest
			await asyncio.sleep(FRAME_INTERVAL_SECONDS)

	async def send_events() -> None:
		while True:
			event = await queue.get()
			await websocket.send_json(event)

	async def receive_controls() -> None:
		while True:
			message = await websocket.receive_json()
			if message.get("type") == "pause":
				paused.set()
			elif message.get("type") == "resume":
				paused.clear()

	try:
		await websocket.send_json({
			"type": "replay",
			"events": await redis_service.get_agent_events(session_id),
		})
		tasks = [
			asyncio.create_task(send_events()),
			asyncio.create_task(receive_controls()),
		]
		if frames:
			tasks.append(asyncio.create_task(send_frames()))
		# Whichever loop ends first (usually the client disconnecting) tears down the rest.
		done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
		for task in pending:
			task.cancel()
		await asyncio.gather(*pending, return_exceptions=True)
		for task in done:
			exc = task.exception()
			if exc and not isinstance(exc, WebSocketDisconnect):
				print(f"Sandbox socket closed with error: {exc!r}")
	except WebSocketDisconnect:
		pass
	finally:
		stream_hub.unsubscribe(session_id, queue)


@sandbox_router.post("/open")
async def open_url_in_session(
	session_id: UUID4 = Query(..., description="Chat / browser session id"),
	url: str = Query(..., description="URL to open in the sandbox browser"),
) -> dict[str, bool]:
	"""Open a URL in the session browser (used when user pastes a link in chat)."""
	if not session_service.has_session(session_id):
		return {"ok": False}
	try:
		await session_service.navigate_to_url(session_id, url)
		return {"ok": True}
	except Exception:
		return {"ok": False}


@sandbox_router.post("/fill-uci-form")
async def fill_uci_form(request: FillUciFormRequest) -> dict:
	try:
		await session_service.ensure_session(request.sessionId)
		result = await fill_uci_post_course_form(request.sessionId, request.answers)
		return result
	except Exception as exc:
		return {"ok": False, "error": str(exc)}


@sandbox_router.post("/event")
async def sandbox_event(request: BrowserEventRequest) -> dict[str, bool]:
	if not session_service.has_session(request.sessionId):
		return {"ok": False}

	try:
		await _handle_sandbox_event(request)
	except Exception as exc:
		# A page that fails to load shouldn't surface as a 500 (which also hides CORS headers).
		print(f"Sandbox event {request.type} failed: {exc}")
		return {"ok": False}
	return {"ok": True}


async def _handle_sandbox_event(request: BrowserEventRequest) -> None:
	payload = request.payload or {}

	if request.type == "scroll" and payload.get("refresh"):
		active_id = session_service.get_active_page_id(request.sessionId)
		if active_id is not None:
			try:
				await session_service.set_active_page(request.sessionId, active_id)
			except KeyError:
				pass

	if request.type == "navigate":
		url = payload.get("url")
		if url:
			await session_service.navigate_to_url(request.sessionId, str(url))
		else:
			urls = _URL_RE.findall(str(payload.get("value") or ""))
			if urls:
				await session_service.navigate_to_url(request.sessionId, urls[0])

	if request.type == "input" and request.targetId:
		value = payload.get("value")
		urls = _URL_RE.findall(str(value or ""))
		if urls:
			await session_service.navigate_to_url(request.sessionId, urls[0])
