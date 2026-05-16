from enum import Enum
from typing import List, Union
from pydantic import BaseModel, UUID4
from response_models import FormFieldType


# =========================
# Incoming Query
# =========================

class UserQuery(BaseModel):
    query: str


# =========================
# High Level Intent Domain
# =========================

class IntentDomain(str, Enum):
    APP = "app"              # Control your application
    WEBSITE = "website"      # Interact with webpage content
    FORM = "form"
    INVALID = "invalid"


# =========================
# App-Level Actions
# =========================

class AppIntentTypes(str, Enum):
    SWITCH_TAB = "switch_tab"
    DELETE_CONVERSATION = "delete_conversation"
    CREATE_CONVERSATION = "create_conversation"
    FULL_SCREEN = "full_screen_browser"
    MINIMIZE = "minimize_browser"
    OPEN_SETTINGS = "open_settings"


class AppIntent(BaseModel):
    type: AppIntentTypes
    id: UUID4

# =========================
# Website-Level Actions
# =========================

class WebsiteIntent(str, Enum):
    CLICK = "click"
    TYPE = "type"
    SELECT = "select"
    SUBMIT = "submit"
    SEARCH = "search"
    SCROLL = "scroll"
    NAVIGATE = "navigate"
    UPDATE_FORM = "update_form"

# =========================
# Form Update Models
# =========================

class UserUpdateIntent(BaseModel):
    form_reference_id: UUID4
    form_field_new_value: List[FormFieldType]


class UserSubmitForm(BaseModel):
    reference_id: UUID4


# =========================
# Main Parsed Intent
# =========================

class ParsedIntent(BaseModel):
    domain: IntentDomain
    intent: Union[AppIntent, WebsiteIntent, UserUpdateIntent]
