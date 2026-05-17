/** Shapes returned by the FastAPI backend (models/app_models.py). */

export type BackendChatResponseType =
  | 'app_intent'
  | 'UI_response'
  | 'form_update_response'

export type BackendAppIntentType =
  | 'switch_conversation_tab'
  | 'delete_conversation'
  | 'create_conversation'
  | 'full_screen_browser'
  | 'minimize_browser'
  | 'open_settings'

export type BackendUiResponseType =
  | 'form'
  | 'markdown'
  | 'list'
  | 'conversation'
  | 'confirmation'

export type BackendChatResponse = {
  response_type: BackendChatResponseType
  response: Record<string, unknown>
}

export type BackendAppIntent = {
  type: BackendAppIntentType
  id?: string | null
}

export type BackendFormUpdateIntent = {
  form_reference_id: string
  form_field_new_value?: unknown[]
}
