from typing import List, Optional
from pydantic import BaseModel, UUID4


class BrowserPageInfo(BaseModel):
	id: UUID4
	title: str
	url: str
	is_active: bool = False


class SandboxPagesResponse(BaseModel):
	pages: List[BrowserPageInfo]
	active_page_id: Optional[UUID4] = None


class ChatRequest(BaseModel):
	query: str
	sessionId: UUID4


class ChatResponse(BaseModel):
	message: str
	url: Optional[str] = None
	streamUrl: Optional[str] = None
	contextLabel: Optional[str] = None
	pages: List[BrowserPageInfo] = []
	activePageId: Optional[UUID4] = None
	needsClarification: bool = False
