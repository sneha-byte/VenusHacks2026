from datetime import datetime
from enum import Enum
from typing import List, Optional, Union, Literal
from uuid import uuid4
from pydantic import BaseModel, Field, UUID4


# =========================================================
# ENUMS
# =========================================================

class UIResponseType(str, Enum):
    form = "form"
    markdown = "markdown"
    list = "list"
    conversation = "conversation"
    confirmation = "confirmation"


class FormFieldType(str, Enum):
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
    id: UUID4 = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=datetime.now)


# =========================================================
# FORM FIELDS
# =========================================================

class FormOption(BaseModel):
    label: str
    value: str


class BaseFormField(UIBase):
    name: str
    label: str
    required: bool = False
    placeholder: Optional[str] = None


class TextField(BaseFormField):
    type: Literal[FormFieldType.text]
    value: Optional[str] = None


class NumberField(BaseFormField):
    type: Literal[FormFieldType.number]
    value: Optional[float] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None


class DateField(BaseFormField):
    type: Literal[FormFieldType.date]
    value: Optional[datetime] = None


class RadioField(BaseFormField):
    type: Literal[FormFieldType.radio]
    options: List[FormOption]
    selected: Optional[str] = None


class MultiSelectField(BaseFormField):
    type: Literal[FormFieldType.multiselect]
    options: List[FormOption]
    selected: List[str] = []


class SliderField(BaseFormField):
    type: Literal[FormFieldType.slider]
    min_value: int
    max_value: int
    value: Optional[int] = None


FormField = Union[
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
    type: Literal[UIResponseType.form]
    title: Optional[str] = None
    description: Optional[str] = None
    fields: List[FormField]
    submitted: bool = False


class MarkdownResponse(UIBase):
    type: Literal[UIResponseType.markdown]
    content: str


class ListItem(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    url: Optional[str] = None
    img_url: Optional[str] = None


class ListResponse(UIBase):
    type: Literal[UIResponseType.list]
    title: Optional[str] = None
    items: List[ListItem]


class ConversationMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    message: str
    timestamp: datetime = Field(default_factory=datetime.now)


class ConversationResponse(UIBase):
    type: Literal[UIResponseType.conversation]
    messages: List[ConversationMessage]


class ConfirmationResponse(UIBase):
    type: Literal[UIResponseType.confirmation]
    title: str
    message: str

    confirmation_document_url: Optional[str] = None
    display_document_inline: bool = False


# =========================================================
# MAIN UI STATE
# =========================================================

UIResponse = Union[
    FormResponse,
    MarkdownResponse,
    ListResponse,
    ConversationResponse,
    ConfirmationResponse,
]


# The state of an individual chat session
class ChatSessionState(BaseModel):
    id: UUID4 = Field(default_factory=uuid4)
    ui_states: List[UIResponse] = []


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
    chat_sessions: List[ChatSessionState] = []
    accessibility_options: AccessibilityOptions

