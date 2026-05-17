import type { PreviewPage, SandboxSession, SimplifiedField, SimplifiedUiState } from '../types'
import type { BackendChatResponse } from './backend'
import { sandboxStreamUrl } from './backend'

export type AppIntentAction = {
  type: string
  targetId?: string | null
}

export type AgentReply = {
  message: string
  simplifiedUi: SimplifiedUiState | null
  formReferenceId?: string
  appIntent?: AppIntentAction
  confirmationUrl?: string
}

function fieldTypeFromBackend(type: string): SimplifiedField['type'] {
  switch (type) {
    case 'date':
      return 'date'
    case 'radio':
    case 'multiselect':
      return 'select'
    default:
      return 'text'
  }
}

function mapFormFields(fields: unknown[]): SimplifiedField[] {
  return fields.map((raw) => {
    const f = raw as Record<string, unknown>
    const id = String(f.id ?? f.name ?? crypto.randomUUID())
    const backendType = String(f.type ?? 'text')
    const options = Array.isArray(f.options)
      ? (f.options as Record<string, unknown>[]).map((o) =>
          String(o.label ?? o.value ?? ''),
        )
      : undefined

    let value = ''
    if (f.value != null) value = String(f.value)
    if (backendType === 'radio' && f.selected != null) value = String(f.selected)
    if (backendType === 'multiselect' && Array.isArray(f.selected)) {
      value = f.selected.map(String).join(', ')
    }

    return {
      id,
      label: String(f.label ?? f.name ?? 'Field'),
      type: fieldTypeFromBackend(backendType),
      value,
      placeholder: f.placeholder != null ? String(f.placeholder) : undefined,
      required: Boolean(f.required),
      options: options?.length ? options : undefined,
    }
  })
}

function uiToReply(ui: Record<string, unknown>): AgentReply {
  const uiType = String(ui.type ?? '')

  if (uiType === 'form') {
    const simplifiedUi: SimplifiedUiState = {
      title: String(ui.title ?? 'Form'),
      description: ui.description != null ? String(ui.description) : undefined,
      fields: mapFormFields(Array.isArray(ui.fields) ? ui.fields : []),
      formReferenceId: ui.id != null ? String(ui.id) : undefined,
    }
    return {
      message: `Here is the simplified form: ${simplifiedUi.title}`,
      simplifiedUi,
      formReferenceId: simplifiedUi.formReferenceId,
    }
  }

  if (uiType === 'markdown') {
    return { message: String(ui.content ?? ''), simplifiedUi: null }
  }

  if (uiType === 'list') {
    const items = Array.isArray(ui.items) ? ui.items : []
    const body = items
      .map((item) => {
        const row = item as Record<string, unknown>
        return `• ${String(row.title ?? 'Item')}`
      })
      .join('\n')
    return {
      message: ui.title ? `${String(ui.title)}\n\n${body}` : body || 'No items.',
      simplifiedUi: null,
    }
  }

  if (uiType === 'conversation') {
    const messages = Array.isArray(ui.messages) ? ui.messages : []
    const body = messages
      .map((m) => {
        const row = m as Record<string, unknown>
        return `${String(row.role ?? 'assistant')}: ${String(row.message ?? '')}`
      })
      .join('\n\n')
    return { message: body || 'No messages.', simplifiedUi: null }
  }

  if (uiType === 'confirmation') {
    return {
      message: String(ui.message ?? ui.title ?? 'Done.'),
      simplifiedUi: null,
      confirmationUrl:
        ui.confirmation_document_url != null
          ? String(ui.confirmation_document_url)
          : undefined,
    }
  }

  return { message: 'Response received.', simplifiedUi: null }
}

export function mapAgentChatResponse(data: BackendChatResponse): AgentReply {
  const response = data.response ?? {}

  if (data.response_type === 'app_intent') {
    const type = String(response.type ?? '')
    const labels: Record<string, string> = {
      switch_conversation_tab: 'Switching conversation.',
      delete_conversation: 'Removing conversation.',
      create_conversation: 'Starting a new conversation.',
      full_screen_browser: 'Expanding preview.',
      minimize_browser: 'Minimizing preview.',
      open_settings: 'Opening settings.',
    }
    return {
      message: labels[type] ?? 'App action received.',
      simplifiedUi: null,
      appIntent: {
        type,
        targetId: response.id != null ? String(response.id) : null,
      },
    }
  }

  if (data.response_type === 'form_update_response') {
    return {
      message: 'Form update recorded.',
      simplifiedUi: null,
      formReferenceId:
        response.form_reference_id != null
          ? String(response.form_reference_id)
          : undefined,
    }
  }

  return uiToReply(response)
}

export function latestFormFromStates(
  states: unknown[],
): SimplifiedUiState | null {
  for (let i = states.length - 1; i >= 0; i--) {
    const state = states[i]
    if (state && typeof state === 'object' && String((state as Record<string, unknown>).type) === 'form') {
      return uiToReply(state as Record<string, unknown>).simplifiedUi
    }
  }
  return null
}

export function buildSandboxView(
  chatSessionId: string,
  pages: PreviewPage[],
  activePageId: string | null,
  pageUrls: string[],
): SandboxSession {
  const active =
    pages.find((p) => p.isActive) ??
    pages.find((p) => p.id === activePageId) ??
    pages[0]

  const url = active?.url ?? pageUrls[0]
  const hasStream = pages.length > 0

  return {
    pages,
    activePageId: activePageId ?? undefined,
    streamUrl: hasStream ? sandboxStreamUrl(chatSessionId) : undefined,
    url,
    contextLabel: active?.title,
    paused: false,
    minimized: false,
    showPreview: true,
  }
}
