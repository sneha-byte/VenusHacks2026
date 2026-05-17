/**
 * HTTP client aligned with backend routes (sessions, agent, sandbox).
 * Do not change request/response shapes without matching the Python API.
 */

import type { BrowserEvent, PreviewPage } from '../types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type UserStateDto = {
  id: string
  onboarded: boolean
  chat_session_ids: string[]
}

export type ChatSessionStateDto = {
  id: string
  chat_name?: string | null
}

export type ChatSessionDetailDto = {
  page_urls: string[]
  chat_session_states: unknown[]
}

export type BackendChatResponseType =
  | 'app_intent'
  | 'UI_response'
  | 'form_update_response'

export type BackendChatResponse = {
  response_type: BackendChatResponseType
  response: Record<string, unknown>
}

export type SandboxPagesDto = {
  pages: Array<{
    id: string
    title: string
    url: string
    is_active: boolean
  }>
  active_page_id: string | null
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export function sandboxStreamUrl(chatSessionId: string): string {
  return `${API_BASE}/sandbox/stream/${chatSessionId}`
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}

export async function createUserSession(): Promise<UserStateDto> {
  const res = await fetch(`${API_BASE}/session/create-user-session`, { method: 'POST' })
  return parseJson(res)
}

export async function getUserSession(userSessionId: string): Promise<UserStateDto> {
  const res = await fetch(
    `${API_BASE}/session/?session_id=${encodeURIComponent(userSessionId)}`,
  )
  return parseJson(res)
}

export async function listChatSessions(userSessionId: string): Promise<string[]> {
  const res = await fetch(
    `${API_BASE}/session/message-sessions?user_session_id=${encodeURIComponent(userSessionId)}`,
  )
  return parseJson(res)
}

export async function createChatSession(userSessionId: string): Promise<ChatSessionStateDto> {
  const res = await fetch(
    `${API_BASE}/session/create-message-session?user_session_id=${encodeURIComponent(userSessionId)}`,
    { method: 'POST' },
  )
  return parseJson(res)
}

export async function deleteChatSession(
  userSessionId: string,
  chatSessionId: string,
): Promise<boolean> {
  const params = new URLSearchParams({
    user_session_id: userSessionId,
    chat_session_id: chatSessionId,
  })
  const res = await fetch(`${API_BASE}/session/delete-message-session?${params}`, {
    method: 'DELETE',
  })
  return parseJson(res)
}

export async function getChatSessionDetail(
  chatSessionId: string,
): Promise<ChatSessionDetailDto> {
  const res = await fetch(
    `${API_BASE}/session/chat-session-detail?session_id=${encodeURIComponent(chatSessionId)}`,
  )
  return parseJson(res)
}

/** POST /agent/chat — body: { query, session_id } */
export async function postAgentChat(
  query: string,
  chatSessionId: string,
): Promise<BackendChatResponse> {
  const res = await fetch(`${API_BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, session_id: chatSessionId }),
  })
  return parseJson(res)
}

/** POST /agent/submit-form — body: { session_id, form_reference_id } */
export async function postAgentSubmitForm(
  chatSessionId: string,
  formReferenceId: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/agent/submit-form`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: chatSessionId,
      form_reference_id: formReferenceId,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Form submission failed.')
  }
}

export async function fetchSandboxPages(chatSessionId: string): Promise<{
  pages: PreviewPage[]
  activePageId: string | null
}> {
  const res = await fetch(`${API_BASE}/sandbox/pages/${chatSessionId}`)
  if (!res.ok) return { pages: [], activePageId: null }
  const data = (await res.json()) as SandboxPagesDto
  return {
    pages: data.pages.map((p) => ({
      id: String(p.id),
      title: p.title,
      url: p.url,
      isActive: p.is_active,
    })),
    activePageId: data.active_page_id ? String(data.active_page_id) : null,
  }
}

export async function postSandboxEvent(
  event: BrowserEvent,
  chatSessionId: string,
): Promise<void> {
  await fetch(`${API_BASE}/sandbox/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...event, sessionId: chatSessionId }),
  })
}
