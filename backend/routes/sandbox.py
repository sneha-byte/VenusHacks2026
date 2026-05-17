import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import UUID4, BaseModel

from models.sandbox_models import BrowserPageInfo, SandboxPagesResponse
from services.session_service import session_service

sandbox_router = APIRouter(prefix="/sandbox", tags=["Sandbox"])

_URL_RE = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)


class BrowserEventRequest(BaseModel):
	type: str
	sessionId: UUID4
	targetId: str | None = None
	payload: dict | None = None


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


@sandbox_router.post("/event")
async def sandbox_event(request: BrowserEventRequest) -> dict[str, bool]:
	if not session_service.has_session(request.sessionId):
		return {"ok": False}

	payload = request.payload or {}

	if request.type == "scroll" and payload.get("refresh"):
		active_id = session_service.get_active_page_id(request.sessionId)
		if active_id is not None:
			try:
				await session_service.set_active_page(request.sessionId, active_id)
			except KeyError:
				pass

	if request.type == "input" and request.targetId:
		value = payload.get("value")
		urls = _URL_RE.findall(str(value or ""))
		if urls:
			await session_service.open_page(request.sessionId, urls[0])

	return {"ok": True}
