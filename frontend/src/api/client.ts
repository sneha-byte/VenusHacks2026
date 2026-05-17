import type { BrowserEvent, PreviewPage } from '../types'
import type { BackendChatResponse } from './agentTypes'
import { parseAgentChatResponse, type ParsedAgentReply } from './uiAdapter'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type AgentChatResult = ParsedAgentReply

export type SandboxPagesResponse = {
  pages: Array<{
    id: string
    title: string
    url: string
    is_active: boolean
  }>
  active_page_id: string | null
}

function mapPage(p: SandboxPagesResponse['pages'][number]): PreviewPage {
  return {
    id: String(p.id),
    title: p.title,
    url: p.url,
    isActive: p.is_active,
  }
}

export function getSandboxStreamUrl(sessionId: string): string {
  return `${API_BASE}/sandbox/stream/${sessionId}`
}

/** POST /agent/chat */
export async function sendChatQuery(
  query: string,
  sessionId: string,
): Promise<AgentChatResult> {
  const res = await fetch(`${API_BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, session_id: sessionId }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Could not reach the assistant. Is the backend running?')
  }

  const data = (await res.json()) as BackendChatResponse
  return parseAgentChatResponse(data)
}

/** POST /agent/submit-form */
export async function submitAgentForm(
  sessionId: string,
  formReferenceId: string,
): Promise<AgentChatResult> {
  const res = await fetch(`${API_BASE}/agent/submit-form`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      form_reference_id: formReferenceId,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Form submission failed.')
  }

  const data = (await res.json()) as BackendChatResponse | Record<string, unknown>
  if ('response_type' in data && 'response' in data) {
    return parseAgentChatResponse(data as BackendChatResponse)
  }
  return { message: 'Form submitted.' }
}

export async function fetchSandboxPages(sessionId: string): Promise<{
  pages: PreviewPage[]
  activePageId: string | null
}> {
  const res = await fetch(`${API_BASE}/sandbox/pages/${sessionId}`)
  if (!res.ok) {
    return { pages: [], activePageId: null }
  }
  const data = (await res.json()) as SandboxPagesResponse
  return {
    pages: data.pages.map(mapPage),
    activePageId: data.active_page_id ? String(data.active_page_id) : null,
  }
}

/** POST /sandbox/event */
export async function sendBrowserEvent(
  event: BrowserEvent,
  sessionId: string,
): Promise<void> {
  await fetch(`${API_BASE}/sandbox/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...event, sessionId }),
  })
}
