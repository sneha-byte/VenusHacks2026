const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type UserStateDto = {
  id: string
  onboarded: boolean
  chat_session_ids: string[]
}

export type ChatSessionStateDto = {
  id: string
  ui_states?: unknown[]
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
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

export async function listMessageSessions(userSessionId: string): Promise<string[]> {
  const res = await fetch(
    `${API_BASE}/session/message-sessions?user_session_id=${encodeURIComponent(userSessionId)}`,
  )
  return parseJson(res)
}

export async function createMessageSession(
  userSessionId: string,
): Promise<ChatSessionStateDto> {
  const res = await fetch(
    `${API_BASE}/session/create-message-session?user_session_id=${encodeURIComponent(userSessionId)}`,
    { method: 'POST' },
  )
  return parseJson(res)
}

export async function deleteMessageSession(
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

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}
