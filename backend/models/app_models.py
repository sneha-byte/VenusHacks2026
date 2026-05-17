from datetime import datetime
from enum import Enum
from typing import List, Union, Optional, Literal
from uuid import uuid4

from pydantic import BaseModel, UUID4, Field


# user inputs text query in the app
class UserQuery(BaseModel):
    query: str = Field(
        description="Raw natural-language request typed or spoken by the user."
    )
    session_id: UUID4 = Field(
        description="Unique chat/browser session identifier associated with the request."
    )


# High Level user Intent Domain such as open settings click renew
class IntentDomain(str, Enum):
    APP = "app"              # Control your application
    WEBSITE = "website"      # Interact with webpage content
    FORM = "form"
    INVALID = "invalid"


# Invalid intent
class InvalidIntent(BaseModel):
    reason: str = Field(
        description="Human-readable explanation of why the request could not be classified."
    )


# app intent types such as switch tab, open settings, minimize browser
class AppIntentTypes(str, Enum):
    SWITCH_TAB = "switch_conversation_tab"
    DELETE_CONVERSATION = "delete_conversation"
    CREATE_CONVERSATION = "create_conversation"
    FULL_SCREEN = "full_screen_browser"
    MINIMIZE = "minimize_browser"
    OPEN_SETTINGS = "open_settings"


# specific app intent info such as open_settings
class AppIntent(BaseModel):
    type: AppIntentTypes = Field(
        description="App command the session/app layer should execute."
    )
    id: UUID4 | None = Field(
        default=None,
        description="Target id for commands that operate on a specific session or UI object."
    )


# browser intent types such as click, type, select, submit, search, scroll, navigate
class WebsiteIntent(str, Enum):
    CLICK = "click"
    TYPE = "type"
    SELECT = "select"
    SUBMIT = "submit"
    SEARCH = "search"
    SCROLL = "scroll"
    NAVIGATE = "navigate"
    UPDATE_FORM = "update_form"


# user intent when they want to update a form field value
class FormUpdateIntent(BaseModel):
    form_reference_id: UUID4 = Field(
        description="Id of the simplified form the user wants to change."
    )
    form_field_new_value: List["FormField"] = Field(
        description="Updated form field values extracted from the user request."
    )


# user clicked submit
class FormSubmissionRequest(BaseModel):
    session_id: UUID4 = Field(
        description="Chat/browser session associated with the form submission."
    )
    form_reference_id: UUID4 = Field(
        description="Identifier of the simplified form being submitted."
    )


# AI's understanding of user intent
class ParsedIntent(BaseModel):
    domain: IntentDomain = Field(
        description="Domain that determines which subsystem should handle the request."
    )
    intent: Union[AppIntent, WebsiteIntent, FormUpdateIntent, InvalidIntent] = Field(
        description="Specific action payload for the selected domain."
    )


# update user state with new ui state
class UpdateUserStateRequest(BaseModel):
    session_id: UUID4 = Field(
        description="User session being updated."
    )
    new_user_state: "UserState" = Field(
        description="Full replacement state for the user session."
    )


# update ui in current chat session
class UpdateSessionStateRequest(BaseModel):
    session_id: UUID4 = Field(
        description="Chat/session id whose UI state should receive this update."
    )
    new_ui_state: "UIResponse" = Field(
        description="New simplified UI block to store and render."
    )


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


class UIBase(BaseModel):
    id: UUID4 = Field(
        default_factory=uuid4,
        description="Unique identifier for the UI object."
    )
    created_at: datetime = Field(
        default_factory=datetime.now,
        description="Timestamp indicating when the UI object was created."
    )


class FormOption(BaseModel):
    label: str = Field(
        description="Human-readable option label shown in the frontend."
    )
    value: str = Field(
        description="Underlying value submitted back to the browser workflow."
    )


class BaseFormField(UIBase):
    name: str = Field(
        description="Internal field name mapped to the original website form field."
    )
    label: str = Field(
        description="Human-readable label displayed to the user."
    )
    required: bool = Field(
        default=False,
        description="Whether the field must be completed before submission."
    )
    placeholder: Optional[str] = Field(
        default=None,
        description="Placeholder text displayed when the field has no value."
    )


class TextField(BaseFormField):
    type: Literal[FormFieldType.text] = Field(
        description="Discriminator identifying this as a text field."
    )
    value: Optional[str] = Field(
        default=None,
        description="Current text value entered by the user."
    )


class NumberField(BaseFormField):
    type: Literal[FormFieldType.number] = Field(
        description="Discriminator identifying this as a number field."
    )
    value: Optional[float] = Field(
        default=None,
        description="Current numeric value entered by the user."
    )
    min_value: Optional[float] = Field(
        default=None,
        description="Minimum allowed numeric value."
    )
    max_value: Optional[float] = Field(
        default=None,
        description="Maximum allowed numeric value."
    )


class DateField(BaseFormField):
    type: Literal[FormFieldType.date] = Field(
        description="Discriminator identifying this as a date field."
    )
    value: Optional[datetime] = Field(
        default=None,
        description="Selected date value."
    )


class RadioField(BaseFormField):
    type: Literal[FormFieldType.radio] = Field(
        description="Discriminator identifying this as a radio field."
    )
    options: List[FormOption] = Field(
        description="Available radio button options."
    )
    selected: Optional[str] = Field(
        default=None,
        description="Currently selected option value."
    )


class MultiSelectField(BaseFormField):
    type: Literal[FormFieldType.multiselect] = Field(
        description="Discriminator identifying this as a multiselect field."
    )
    options: List[FormOption] = Field(
        description="Available selectable options."
    )
    selected: List[str] = Field(
        default_factory=list,
        description="Currently selected option values."
    )


class SliderField(BaseFormField):
    type: Literal[FormFieldType.slider] = Field(
        description="Discriminator identifying this as a slider field."
    )
    min_value: int = Field(
        description="Minimum slider value."
    )
    max_value: int = Field(
        description="Maximum slider value."
    )
    value: Optional[int] = Field(
        default=None,
        description="Current slider value."
    )


FormField = Union[
    TextField,
    NumberField,
    DateField,
    RadioField,
    MultiSelectField,
    SliderField,
]


class FormResponse(UIBase):
    type: Literal[UIResponseType.form] = Field(
        description="Discriminator identifying this as a form response."
    )
    title: Optional[str] = Field(
        default=None,
        description="Short title displayed above the form."
    )
    description: Optional[str] = Field(
        default=None,
        description="Additional context or instructions for the form."
    )
    fields: List[FormField] = Field(
        description="List of simplified form fields rendered in the frontend."
    )
    submitted: bool = Field(
        default=False,
        description="Whether the form has already been submitted."
    )
    is_next: bool = Field(
        default=False,
        description="Whether this form represents the next step in a multi-step flow."
    )


class MarkdownResponse(UIBase):
    type: Literal[UIResponseType.markdown] = Field(
        description="Discriminator identifying this as a markdown response."
    )
    content: str = Field(
        description="Markdown content rendered directly in the frontend."
    )


class ListItem(BaseModel):
    id: str = Field(
        description="Unique identifier for the list item."
    )
    title: str = Field(
        description="Primary title displayed for the list item."
    )
    description: Optional[str] = Field(
        default=None,
        description="Secondary descriptive text for the list item."
    )
    url: Optional[str] = Field(
        default=None,
        description="Optional external or internal navigation URL."
    )
    img_url: Optional[str] = Field(
        default=None,
        description="Optional image preview URL associated with the item."
    )


class ListResponse(UIBase):
    type: Literal[UIResponseType.list] = Field(
        description="Discriminator identifying this as a list response."
    )
    title: Optional[str] = Field(
        default=None,
        description="Optional heading displayed above the list."
    )
    items: List[ListItem] = Field(
        description="List of simplified result or option items."
    )


class ConversationResponse(UIBase):
    type: Literal[UIResponseType.conversation] = Field(
        description="Discriminator identifying this as a conversation response."
    )
    role: Literal["user", "assistant", "system"] = Field(
        description="Message role used for rendering conversation history."
    )
    message: str = Field(
        description="Conversation message content."
    )


class ConfirmationResponse(UIBase):
    type: Literal[UIResponseType.confirmation] = Field(
        description="Discriminator identifying this as a confirmation response."
    )
    title: str = Field(
        description="Confirmation title shown to the user."
    )
    message: str = Field(
        description="Confirmation details or completion summary."
    )
    confirmation_document_url: Optional[str] = Field(
        default=None,
        description="Optional downloadable confirmation document URL."
    )
    display_document_inline: bool = Field(
        default=False,
        description="Whether the confirmation document should be embedded inline."
    )


UIResponse = Union[
    FormResponse,
    MarkdownResponse,
    ListResponse,
    ConversationResponse,
    ConfirmationResponse,
]


class AgentResponse(BaseModel):
    response_type: UIResponseType = Field(
        description="Frontend response type discriminator."
    )
    response: UIResponse = Field(
        description="Rendered UI response payload."
    )


class ChatSessionState(BaseModel):
    id: UUID4 = Field(
        default_factory=uuid4,
        description="Unique identifier for the chat/browser session."
    )
    created_at: datetime = Field(
        default_factory=datetime.now,
        description="Timestamp when the session was created."
    )
    chat_name: Optional[str] = Field(
        default=None,
        description="User-visible name for the chat session."
    )
    ui_states: List[UIResponse] = Field(
        default_factory=list,
        description="Chronological history of simplified UI states."
    )


class AccessibilityOptions(BaseModel):
    dark_mode: bool = Field(
        default=False,
        description="Whether dark mode is enabled."
    )
    high_contrast: bool = Field(
        default=False,
        description="Whether high contrast mode is enabled."
    )
    dyslexia_friendly: bool = Field(
        default=False,
        description="Whether dyslexia-friendly typography is enabled."
    )
    full_voice: bool = Field(
        default=False,
        description="Whether full voice interaction is enabled."
    )
    text_scaling: float = Field(
        default=1.0,
        description="Global frontend text scaling multiplier."
    )


class UserState(BaseModel):
    id: UUID4 = Field(
        default_factory=uuid4,
        description="Unique identifier for the user."
    )
    onboarded: bool = Field(
        default=False,
        description="Whether the onboarding flow has been completed."
    )
    chat_session_ids: List[UUID4] = Field(
        default_factory=list,
        description="List of associated chat session identifiers."
    )
    accessibility_options: AccessibilityOptions = Field(
        default_factory=AccessibilityOptions,
        description="Accessibility preferences for the user."
    )


class GetChatDetailsResponse(BaseModel):
    page_urls: List[str] = Field(
        default_factory=list,
        description="Visited or associated page URLs for the session."
    )
    chat_session_states: List[ChatSessionState] = Field(
        description="Detailed state for each chat session."
    )


class ChatResponseType(str, Enum):
    APP_INTENT = "app_intent"
    UI_RESPONSE = "UI_response"
    FORM_UPDATE_RESPONSE = "form_update_response"


class ChatResponse(BaseModel):
    response_type: ChatResponseType = Field(
        description="Top-level response category returned to the frontend."
    )
    response: Union[UIBase, AppIntent] = Field(
        description="Payload associated with the response type."
    )