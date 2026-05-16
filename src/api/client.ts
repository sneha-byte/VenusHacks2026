import type { ActionLogItem, BrowserEvent, SimplifiedUiState } from '../types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type ChatResponse = {
  message: string
  simplifiedUi?: SimplifiedUiState
  url?: string
  streamUrl?: string
  contextLabel?: string
  actionLog?: ActionLogItem[]
  needsClarification?: boolean
}

/** POST /chat — wire to your browser-use agent backend */
export async function sendChatQuery(
  query: string,
  sessionId: string,
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, sessionId }),
  })

  if (!res.ok) {
    throw new Error('Could not reach the assistant. Is the backend running?')
  }

  return res.json()
}

/** POST /sandbox/event — mirror user actions to the sandboxed browser */
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

/** GET /sandbox/stream — URL for live browser stream */
export function getSandboxStreamUrl(sessionId: string): string {
  return `${API_BASE}/sandbox/stream/${sessionId}`
}
