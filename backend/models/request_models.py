from enum import Enum
from typing import List, Union
from pydantic import BaseModel, UUID4
from models.response_models import FormFieldType, UIResponse, UserState


#user inputs text query in the app
class UserQuery(BaseModel):
    # Raw natural-language request typed or spoken by the user.
    query: str


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
    SWITCH_TAB = "switch_tab"
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
    id: UUID4

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
    form_reference_id: UUID4
    # Field types involved in the update. The natural-language query still carries the exact new value.
    form_field_new_value: List[FormFieldType]

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
