import uuid
from dataclasses import dataclass

from browser_use import Agent
from browser_use.browser.profile import ViewportSize
from browser_use.llm import ChatDeepSeek
from playwright.async_api import (
	Browser,
	BrowserContext,
	Page,
	Playwright,
	async_playwright,
)
from pydantic import UUID4
from common.constants import DEEPSEEK_API_KEY


@dataclass
class PageMeta:
	id: UUID4
	url: str
	title: str


class SessionService:
	def __init__(self):
		self._contexts: dict[UUID4, BrowserContext] = {}
		self._pages: dict[UUID4, dict[UUID4, Page]] = {}
		self._page_order: dict[UUID4, list[UUID4]] = {}
		self._active_page_id: dict[UUID4, UUID4] = {}
		self._llm = ChatDeepSeek(api_key=DEEPSEEK_API_KEY)
		self._playwright: Playwright | None = None
		self._browser: Browser | None = None

	async def start(self):
		self._playwright = await async_playwright().start()
		self._browser = await self._playwright.chromium.launch(
			headless=True,
			args=["--no-sandbox"],
		)

	async def stop(self):
		for session_id in list(self._agents.keys()):
			await self.expire_session(session_id)
		if self._browser is not None:
			await self._browser.close()
		if self._playwright is not None:
			await self._playwright.stop()

	def has_session(self, session_id: UUID4) -> bool:
		return session_id in self._contexts

	async def create_new_session(self, start_url: str = "about:blank") -> UUID4:
		session_id = uuid.uuid4()
		if self._browser is None:
			raise RuntimeError("SessionService.start() must be called before create_new_session().")

		context = await self._browser.new_context(viewport={
			"width": 1280,
			"height": 720,
		})
		page = await context.new_page()
		await page.goto(start_url)

		page_id = uuid.uuid4()
		self._contexts[session_id] = context
		self._pages[session_id] = {page_id: page}
		self._page_order[session_id] = [page_id]
		self._active_page_id[session_id] = page_id
		return session_id

	def get_session_context(self, session_id: UUID4) -> BrowserContext | None:
		return self._contexts.get(session_id)

	async def expire_session(self, session_id: UUID4) -> None:
		context = self._contexts.pop(session_id, None)
		self._pages.pop(session_id, None)
		self._page_order.pop(session_id, None)
		self._active_page_id.pop(session_id, None)
		if context is not None:
			await context.close()

	async def _page_meta(self, session_id: UUID4, page_id: UUID4, page: Page) -> PageMeta:
		title = await page.title() or "Untitled"
		return PageMeta(id=page_id, url=page.url, title=title[:80])

	async def list_pages(self, session_id: UUID4) -> tuple[list[PageMeta], UUID4 | None]:
		pages_map = self._pages.get(session_id, {})
		order = self._page_order.get(session_id, [])
		active_id = self._active_page_id.get(session_id)
		result: list[PageMeta] = []
		for page_id in order:
			page = pages_map.get(page_id)
			if page is None:
				continue
			meta = await self._page_meta(session_id, page_id, page)
			result.append(meta)
		return result, active_id

	async def open_page(self, session_id: UUID4, url: str) -> PageMeta:
		context = self._contexts.get(session_id)
		if context is None:
			raise KeyError(f"Unknown session: {session_id}")

		page = await context.new_page()
		await page.goto(url, wait_until="domcontentloaded", timeout=30000)

		page_id = uuid.uuid4()
		self._pages.setdefault(session_id, {})[page_id] = page
		self._page_order.setdefault(session_id, []).append(page_id)
		await self.set_active_page(session_id, page_id)
		return await self._page_meta(session_id, page_id, page)

	async def set_active_page(self, session_id: UUID4, page_id: UUID4) -> PageMeta:
		pages_map = self._pages.get(session_id)
		if pages_map is None or page_id not in pages_map:
			raise KeyError(f"Unknown page {page_id} in session {session_id}")

		page = pages_map[page_id]
		await page.bring_to_front()
		self._active_page_id[session_id] = page_id
		return await self._page_meta(session_id, page_id, page)

	def get_active_page_id(self, session_id: UUID4) -> UUID4 | None:
		return self._active_page_id.get(session_id)

	async def screenshot_active_page(self, session_id: UUID4) -> bytes:
		active_id = self._active_page_id.get(session_id)
		if active_id is None:
			raise KeyError(f"No active page for session {session_id}")
		pages_map = self._pages.get(session_id, {})
		page = pages_map.get(active_id)
		if page is None:
			raise KeyError(f"Active page missing for session {session_id}")
		return await page.screenshot(type="png", full_page=False)

	async def create_session_view(self, session_id: UUID4, page_index: int | None = None) -> dict:
		context = self._contexts.get(session_id)
		if context is None:
			raise KeyError(f"Unknown session: {session_id}")

		if page_index is not None and 0 <= page_index < len(context.pages):
			page = context.pages[page_index]
		else:
			active_id = self._active_page_id.get(session_id)
			pages_map = self._pages.get(session_id, {})
			page = pages_map.get(active_id) if active_id else None
			if page is None and pages_map:
				page = next(iter(pages_map.values()))

		return {
			"session_id": str(session_id),
			"url": page.url if page else None,
			"title": await page.title() if page else None,
		}



session_service = SessionService()
