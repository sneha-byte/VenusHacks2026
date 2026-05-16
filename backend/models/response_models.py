from datetime import datetime
from enum import Enum
from typing import List, Optional, Union, Literal
from uuid import uuid4
from pydantic import BaseModel, Field, UUID4


# =========================================================
# ENUMS
# =========================================================

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


# =========================================================
# BASE MODELS
# =========================================================

class UIBase(BaseModel):
    # Every UI object gets an id so it can be stored, updated, or referenced later.
    id: UUID4 = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=datetime.now)


# =========================================================
# FORM FIELDS
# =========================================================

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


# =========================================================
# UI RESPONSE TYPES
# =========================================================

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


# =========================================================
# MAIN UI STATE
# =========================================================

UIResponse = Union[
    # Main frontend contract: every assistant/browser result should be one of these.
    FormResponse,
    MarkdownResponse,
    ListResponse,
    ConversationResponse,
    ConfirmationResponse,
]


# The state of an individual chat session
class ChatSessionState(BaseModel):
    # One chat/browser session id. Redis can use this id for per-session UI state.
    id: UUID4 = Field(default_factory=uuid4)
    # Ordered UI states shown during this chat session.
    ui_states: List[UIResponse] = Field(default_factory=list)


class AccessibilityOptions(BaseModel):
    dark_mode: bool = False
    high_contrast: bool = False
    dyslexia_friendly: bool = False
    full_voice: bool = False

    text_scaling: float = 1.0


# The state of a user
class UserState(BaseModel):
    id: UUID4 = Field(default_factory=uuid4)
    onboarded: bool = False
    # Store chat ids separately from chat contents so user metadata stays small.
    chat_session_ids: List[UUID4] = Field(default_factory=list)
    accessibility_options: AccessibilityOptions = Field(default_factory=AccessibilityOptions)

