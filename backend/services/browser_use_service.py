from browser_use.llm import ChatDeepSeek
from browser_use import Agent
from common import DEEPSEEK_API_KEY
from models.request_models import UserQuery, ParsedIntent
from models.response_models import FormResponse, ConfirmationResponse, UIBase, ChatSessionState


class BrowserUseService:
    def __init__(self):
        self._llm = ChatDeepSeek(
            api_key=DEEPSEEK_API_KEY
        )

    def infer_user_intent(self, user_query: UserQuery, user_state: ChatSessionState) -> ParsedIntent:
        ...

    def submit_form(self, form_state: FormResponse) -> ConfirmationResponse:
        ...

    def perform_action(self, user_query: UserQuery, user_state: ChatSessionState, intent: ParsedIntent) -> UIBase:
        ...
