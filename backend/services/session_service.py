import uuid
from browser_use import Agent
from browser_use.browser.profile import ViewportSize
from browser_use.llm import ChatDeepSeek
from playwright.async_api import (
    Browser,
    BrowserContext,
    Playwright,
    async_playwright,
)
from pydantic import UUID4
from common.constants import DEEPSEEK_API_KEY


class SessionService:
    def __init__(self):
        self._agents: dict[UUID4, Agent] = {}            # session id → Agent
        self._contexts: dict[UUID4, BrowserContext] = {} # session id → BrowserContext (for cleanup)
        self._llm = ChatDeepSeek(api_key=DEEPSEEK_API_KEY)
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None

    async def start(self):
        self._playwright = await async_playwright().start()  # initializes the Playwright runtime
        self._browser = await self._playwright.chromium.launch(  # starts chromium process
            headless=True,
            args=["--no-sandbox"],
        )

    async def stop(self):
        for session_id in list(self._agents.keys()):  # make a snapshot of the keys before iterating
            await self.expire_session(session_id)
        if self._browser is not None:
            await self._browser.close()
        if self._playwright is not None:
            await self._playwright.stop()

    # looks up a session ID in the agents dict and returns the Agent, or None if the ID isn't there.
    def get_session_agent(self, session_id: UUID4) -> Agent | None:
        return self._agents.get(session_id)

    async def create_new_session(self, start_url: str = "about:blank") -> UUID4:
        session_id = uuid.uuid4()
        #  if start() hasn't been called yet
        if self._browser is None:
            raise RuntimeError("SessionService.start() must be called before create_new_session().")

        context = await self._browser.new_context(viewport=ViewportSize(width=1280, height=720))
        page = await context.new_page()
        await page.goto(start_url)

        agent = Agent(
            task="Wait for the user's first request.",
            llm=self._llm,
            page=page,
        )

        self._agents[session_id] = agent
        self._contexts[session_id] = context
        return session_id

    async def expire_session(self, session_id: UUID4) -> None:
        agent = self._agents.pop(session_id, None)
        context = self._contexts.pop(session_id, None)
        if agent is not None:
            try:
                await agent.close()
            except Exception:
                pass  # best effort
        if context is not None:
            await context.close()

    async def create_session_view(self, session_id: UUID4) -> dict:
        agent = self._agents.get(session_id)
        context = self._contexts.get(session_id)
        if agent is None or context is None:
            raise KeyError(f"Unknown session: {session_id}")
        page = context.pages[0] if context.pages else None
        return {
            "session_id": str(session_id),
            "url": page.url if page else None,
            "title": await page.title() if page else None,
        }

    async def process_user_input(self, session_id: UUID4, user_input: str) -> dict:
        agent = self._agents.get(session_id)
        if agent is None:
            raise KeyError(f"Unknown session: {session_id}")
        agent.task = user_input
        result = await agent.run()
        return {"result": str(result)}

session_service = SessionService()