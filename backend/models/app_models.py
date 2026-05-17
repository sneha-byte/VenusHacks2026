from datetime import datetime
from enum import Enum
from typing import List, Union, Optional, Literal
from uuid import uuid4
from pydantic import BaseModel, UUID4, Field


#user inputs text query in the app
class UserQuery(BaseModel):
    # Raw natural-language request typed or spoken by the user.
    query: str
    session_id: UUID4


# High Level user Intent Domain such as open settings click renew 
class IntentDomain(str, Enum):
    # Top-level bucket that decides which service should handle the request.
    APP = "app"              # Control your application
    WEBSITE = "website"      # Interact with webpage content
    FORM = "form"
    INVALID = "invalid"

# Invalid intent
class InvalidIntent(BaseModel):
    # Human-readable explanation of why the request could not be classified.
    reason: str

# app intent types such as switch tab, open settings, minimize browser
class AppIntentTypes(str, Enum):
    # Actions that affect our app shell instead of the website inside the browser.
    SWITCH_TAB = "switch_conversation_tab"
    DELETE_CONVERSATION = "delete_conversation"
    CREATE_CONVERSATION = "create_conversation"
    FULL_SCREEN = "full_screen_browser"
    MINIMIZE = "minimize_browser"
    OPEN_SETTINGS = "open_settings"

#specific app intent info such as open_settings
class AppIntent(BaseModel):
    # App command the session/app layer should execute.
    type: AppIntentTypes
    # Target id for commands that operate on a specific session or UI object.
    id: UUID4 | None = None

#browser intent types such as click, type, select, submit, search, scroll, navigate
class WebsiteIntent(str, Enum):
    # Actions browser-use can perform against the actual website.
    CLICK = "click"
    TYPE = "type"
    SELECT = "select"
    SUBMIT = "submit"
    SEARCH = "search"
    SCROLL = "scroll"
    NAVIGATE = "navigate"
    UPDATE_FORM = "update_form"


# user intent when they want to update a form field value, such as change date to 12/12/2024, or change slider value to 5
class FormUpdateIntent(BaseModel):
    # Id of the simplified form the user wants to change.
    form_reference_id: UUID4 = Field
    # Field types involved in the update. The natural-language query still carries the exact new value.
    form_field_new_value: List[FormField]

#user clicked submit 
class UserSubmitForm(BaseModel):
    # Id of the simplified form being submitted.
    reference_id: UUID4


# Ai's understanding of user intent, which can be either app control, website interaction, or form update
class ParsedIntent(BaseModel):
    # Domain determines whether app/session code, form code, or browser-use should handle it.
    domain: IntentDomain
    # Specific action payload for the selected domain.
    intent: Union[AppIntent, WebsiteIntent, FormUpdateIntent, InvalidIntent]


# update user state with new ui state such as accessibility options, or new chat session, or onboarding completion
class UpdateUserStateRequest(BaseModel):
    # User session being updated.
    session_id: UUID4
    # Full replacement state for that user session.
    new_user_state: UserState

# update ui in current chat session 
class UpdateSessionStateRequest(BaseModel):
    # Chat/session id whose UI state should receive this update.
    session_id: UUID4
    # New simplified UI block to store and render.
    new_ui_state: UIResponse


class UIResponseType(str, Enum):
    # Values used by the frontend to decide which simplified UI component to render.
    form = "form"
    markdown = "markdown"
    list = "list"
    conversation = "conversation"
    confirmation = "confirmation"


class FormFieldType(str, Enum):
    # Field types that browser-use can extract from real website forms.
    text = "text"
    number = "number"
    date = "date"
    radio = "radio"
    multiselect = "multiselect"
    slider = "slider"


class UIBase(BaseModel):
    # Every UI object gets an id so it can be stored, updated, or referenced later.
    id: UUID4 = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=datetime.now)


class FormOption(BaseModel):
    # A selectable option for radio and multiselect form fields.
    label: str
    value: str


class BaseFormField(UIBase):
    # Shared properties for all simplified form fields.
    # name should map back to the real website field when browser-use can identify it.
    name: str
    label: str
    required: bool = False
    placeholder: Optional[str] = None


class TextField(BaseFormField):
    # Free-text input such as name, email, address, or a short answer.
    type: Literal[FormFieldType.text]
    value: Optional[str] = None


class NumberField(BaseFormField):
    # Numeric input with optional min/max constraints copied from the website.
    type: Literal[FormFieldType.number]
    value: Optional[float] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None


class DateField(BaseFormField):
    # Date input. datetime lets Pydantic validate date-like values consistently.
    type: Literal[FormFieldType.date]
    value: Optional[datetime] = None


class RadioField(BaseFormField):
    # Single-choice field where only one option value can be selected.
    type: Literal[FormFieldType.radio]
    options: List[FormOption]
    selected: Optional[str] = None


class MultiSelectField(BaseFormField):
    # Multi-choice field where multiple option values can be selected.
    type: Literal[FormFieldType.multiselect]
    options: List[FormOption]
    selected: List[str] = Field(default_factory=list)


class SliderField(BaseFormField):
    # Range-like input displayed as a simpler slider in the frontend.
    type: Literal[FormFieldType.slider]
    min_value: int
    max_value: int
    value: Optional[int] = None


FormField = Union[
    # Any field inside a FormResponse must be one of these concrete field models.
    TextField,
    NumberField,
    DateField,
    RadioField,
    MultiSelectField,
    SliderField,
]


class FormResponse(UIBase):
    # Simplified version of a website form for the accessible frontend to render.
    type: Literal[UIResponseType.form]
    title: Optional[str] = None
    description: Optional[str] = None
    fields: List[FormField]
    submitted: bool = False
    is_next: bool = False


class MarkdownResponse(UIBase):
    # Plain content for summaries, explanations, errors, or fallback responses.
    type: Literal[UIResponseType.markdown]
    content: str


class ListItem(BaseModel):
    # One item in a list response, such as a search result, product, link, or option.
    id: str
    title: str
    description: Optional[str] = None
    url: Optional[str] = None
    img_url: Optional[str] = None


class ListResponse(UIBase):
    # A simplified list of choices or results extracted from a website.
    type: Literal[UIResponseType.list]
    title: Optional[str] = None
    items: List[ListItem]


class ConversationMessage(BaseModel):
    # One message in a conversation-style UI response.
    role: Literal["user", "assistant", "system"]
    message: str
    timestamp: datetime = Field(default_factory=datetime.now)


class ConversationResponse(UIBase):
    # A grouped conversation block when the frontend should show message history.
    type: Literal[UIResponseType.conversation]
    messages: List[ConversationMessage]


class ConfirmationResponse(UIBase):
    # Returned after a final action, such as submitting a form or completing a task.
    type: Literal[UIResponseType.confirmation]
    title: str
    message: str
    confirmation_document_url: Optional[str] = None
    display_document_inline: bool = False


UIResponse = Union[
    # Main frontend contract: every assistant/browser result should be one of these.
    FormResponse,
    MarkdownResponse,
    ListResponse,
    ConversationResponse,
    ConfirmationResponse,
]


class AgentResponse(BaseModel):
    response_type: UIResponseType
    response: UIResponse


class ChatSessionState(BaseModel):
    # One chat/browser session id. Redis can use this id for per-session UI state.
    id: UUID4 = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=datetime.now)
    chat_name: Optional[str] = None
    ui_states: List[UIResponse] = Field(default_factory=list)


class AccessibilityOptions(BaseModel):
    dark_mode: bool = False
    high_contrast: bool = False
    dyslexia_friendly: bool = False
    full_voice: bool = False

    text_scaling: float = 1.0


class UserState(BaseModel):
    id: UUID4 = Field(default_factory=uuid4)
    onboarded: bool = False
    # Store chat ids separately from chat contents so user metadata stays small.
    chat_session_ids: List[UUID4] = Field(default_factory=list)
    accessibility_options: AccessibilityOptions = Field(default_factory=AccessibilityOptions)


class GetChatDetailsResponse(BaseModel):
    page_urls: List[str] = Field(default_factory=list)
    chat_session_states: List[ChatSessionState]


class ChatResponseType(str, Enum):
    APP_INTENT = "app_intent"
    UI_RESPONSE = "UI_response"
    FORM_UPDATE_RESPONSE = "form_update_response"


class ChatResponse(BaseModel):
    response_type: ChatResponseType
    response: Union[UIBase, AppIntent]

