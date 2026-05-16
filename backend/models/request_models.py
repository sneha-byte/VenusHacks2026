from enum import Enum
from typing import List, Union
from pydantic import BaseModel, UUID4
from response_models import FormFieldType, UserState, UIBase


#user inputs text query in the app
class UserQuery(BaseModel):
    query: str


# High Level user Intent Domain such as open settings click renew 
class IntentDomain(str, Enum):
    APP = "app"              # Control your application
    WEBSITE = "website"      # Interact with webpage content
    FORM = "form"
    INVALID = "invalid"



# app intent types such as switch tab, open settings, minimize browser
class AppIntentTypes(str, Enum):
    SWITCH_TAB = "switch_tab"
    DELETE_CONVERSATION = "delete_conversation"
    CREATE_CONVERSATION = "create_conversation"
    FULL_SCREEN = "full_screen_browser"
    MINIMIZE = "minimize_browser"
    OPEN_SETTINGS = "open_settings"

#specific app intent info such as open_settings
class AppIntent(BaseModel):
    type: AppIntentTypes
    id: UUID4

#browser intent types such as click, type, select, submit, search, scroll, navigate
class WebsiteIntent(str, Enum):
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
    form_reference_id: UUID4
    form_field_new_value: List[FormFieldType]

#user clicked submit 
class UserSubmitForm(BaseModel):
    reference_id: UUID4


# Ai's understanding of user intent, which can be either app control, website interaction, or form update
class ParsedIntent(BaseModel):
    domain: IntentDomain
    intent: Union[AppIntent, WebsiteIntent, FormUpdateIntent]


# update user state with new ui state such as accessibility options, or new chat session, or onboarding completion
class UpdateUserStateRequest(BaseModel):
    session_id: UUID4
    new_user_state: UserState

# update ui in current chat session 
class UpdateSessionStateRequest(BaseModel):
    session_id: UUID4
    new_ui_state: UIBase
