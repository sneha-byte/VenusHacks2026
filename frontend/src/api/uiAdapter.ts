import type { SimplifiedField, SimplifiedUiState } from '../types'
import type {
  BackendAppIntent,
  BackendChatResponse,
  BackendFormUpdateIntent,
  BackendUiResponseType,
} from './agentTypes'

export type ParsedAgentReply = {
  message: string
  simplifiedUi?: SimplifiedUiState | null
  formReferenceId?: string
  confirmationDocumentUrl?: string
  displayDocumentInline?: boolean
  appIntent?: BackendAppIntent
}

function fieldTypeFromBackend(type: string): SimplifiedField['type'] {
  switch (type) {
    case 'date':
      return 'date'
    case 'multiselect':
    case 'radio':
      return 'select'
    case 'number':
    case 'slider':
    case 'text':
    default:
      return 'text'
  }
}

function fieldValueAsString(field: Record<string, unknown>): string {
  const value = field.value
  if (value == null) return ''
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function mapFormFields(fields: unknown[]): SimplifiedField[] {
  return fields.map((raw) => {
    const field = raw as Record<string, unknown>
    const id = String(field.id ?? field.name ?? crypto.randomUUID())
    const backendType = String(field.type ?? 'text')
    const options =
      Array.isArray(field.options) &&
      field.options.map((opt) => {
        const o = opt as Record<string, unknown>
        return String(o.label ?? o.value ?? '')
      })

    let value = fieldValueAsString(field)
    if (backendType === 'radio' && field.selected != null) {
      value = String(field.selected)
    }
    if (backendType === 'multiselect' && Array.isArray(field.selected)) {
      value = field.selected.map(String).join(', ')
    }

    return {
      id,
      label: String(field.label ?? field.name ?? 'Field'),
      type: fieldTypeFromBackend(backendType),
      value,
      placeholder: field.placeholder != null ? String(field.placeholder) : undefined,
      required: Boolean(field.required),
      options: options && options.length > 0 ? options : undefined,
    }
  })
}

function messageFromUiResponse(ui: Record<string, unknown>): ParsedAgentReply {
  const uiType = String(ui.type ?? '') as BackendUiResponseType

  switch (uiType) {
    case 'form': {
      const simplifiedUi: SimplifiedUiState = {
        title: String(ui.title ?? 'Form'),
        description: ui.description != null ? String(ui.description) : undefined,
        fields: mapFormFields(Array.isArray(ui.fields) ? ui.fields : []),
      }
      return {
        message: simplifiedUi.title
          ? `Here is the simplified form: ${simplifiedUi.title}`
          : 'Here is a simplified form you can fill in.',
        simplifiedUi,
        formReferenceId: ui.id != null ? String(ui.id) : undefined,
      }
    }
    case 'markdown':
      return {
        message: String(ui.content ?? ''),
        simplifiedUi: null,
      }
    case 'list': {
      const items = Array.isArray(ui.items) ? ui.items : []
      const lines = items.map((item) => {
        const row = item as Record<string, unknown>
        const title = String(row.title ?? 'Item')
        const desc = row.description ? ` — ${row.description}` : ''
        return `• ${title}${desc}`
      })
      const title = ui.title ? `${String(ui.title)}\n\n` : ''
      return {
        message: title + (lines.length ? lines.join('\n') : 'No items found.'),
        simplifiedUi: null,
      }
    }
    case 'conversation': {
      const messages = Array.isArray(ui.messages) ? ui.messages : []
      const text = messages
        .map((m) => {
          const msg = m as Record<string, unknown>
          return `${String(msg.role ?? 'assistant')}: ${String(msg.message ?? '')}`
        })
        .join('\n\n')
      return {
        message: text || 'No conversation content.',
        simplifiedUi: null,
      }
    }
    case 'confirmation':
      return {
        message: String(ui.message ?? ui.title ?? 'Done.'),
        simplifiedUi: null,
        confirmationDocumentUrl:
          ui.confirmation_document_url != null
            ? String(ui.confirmation_document_url)
            : undefined,
        displayDocumentInline: Boolean(ui.display_document_inline),
      }
    default:
      return {
        message: 'Received a response from the assistant.',
        simplifiedUi: null,
      }
  }
}

export function parseAgentChatResponse(payload: BackendChatResponse): ParsedAgentReply {
  const response = payload.response ?? {}

  if (payload.response_type === 'app_intent') {
    const intent = response as BackendAppIntent
    const labels: Record<string, string> = {
      switch_conversation_tab: 'Switching conversation.',
      delete_conversation: 'Removing conversation.',
      create_conversation: 'Starting a new conversation.',
      full_screen_browser: 'Expanding browser preview.',
      minimize_browser: 'Minimizing browser preview.',
      open_settings: 'Opening settings.',
    }
    return {
      message: labels[intent.type] ?? 'App action received.',
      appIntent: intent,
    }
  }

  if (payload.response_type === 'form_update_response') {
    const formIntent = response as BackendFormUpdateIntent
    return {
      message: 'Form update recorded.',
      formReferenceId: String(formIntent.form_reference_id),
    }
  }

  return messageFromUiResponse(response)
}

export function latestFormFromUiStates(
  states: unknown[],
): { simplifiedUi: SimplifiedUiState; formReferenceId: string } | null {
  for (let i = states.length - 1; i >= 0; i--) {
    const state = states[i] as Record<string, unknown>
    if (String(state.type) === 'form') {
      const parsed = messageFromUiResponse(state)
      if (parsed.simplifiedUi && parsed.formReferenceId) {
        return {
          simplifiedUi: parsed.simplifiedUi,
          formReferenceId: parsed.formReferenceId,
        }
      }
    }
  }
  return null
}
