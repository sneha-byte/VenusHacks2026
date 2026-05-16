import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  ActionLogItem,
  ChatMessage,
  ChatSession,
  SandboxSession,
  SimplifiedUiState,
} from '../types'
import { sendBrowserEvent, sendChatQuery } from '../api/client'

const SESSIONS_KEY = 'easyweb-sessions-v2'
const ACTIVE_KEY = 'easyweb-active-session'

const emptySandbox = (): SandboxSession => ({
  paused: false,
  minimized: false,
})

function welcomeMessage(): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      'What do you need help with? Tell me the website or form you want to complete.',
    timestamp: Date.now(),
  }
}

export function createEmptyChatSession(): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: 'New chat',
    messages: [welcomeMessage()],
    simplifiedUi: null,
    sandbox: emptySandbox(),
    actionLog: [],
    updatedAt: Date.now(),
  }
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ChatSession[]
      if (parsed.length > 0) return parsed
    }
  } catch {
    /* ignore */
  }
  return []
}

function loadActiveId(sessions: ChatSession[]): string | null {
  const stored = localStorage.getItem(ACTIVE_KEY)
  if (stored && sessions.some((s) => s.id === stored)) return stored
  return sessions[0]?.id ?? null
}

function persist(sessions: ChatSession[], activeId: string | null) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  if (activeId) localStorage.setItem(ACTIVE_KEY, activeId)
  else localStorage.removeItem(ACTIVE_KEY)
}

type SessionContextValue = {
  sessions: ChatSession[]
  activeSessionId: string | null
  messages: ChatMessage[]
  simplifiedUi: SimplifiedUiState | null
  sandbox: SandboxSession
  actionLog: ActionLogItem[]
  isAgentBusy: boolean
  activeFieldId: string | null
  setActiveFieldId: (id: string | null) => void
  createSession: () => string
  selectSession: (id: string) => void
  deleteSession: (id: string) => void
  renameSession: (id: string, title: string) => void
  sendMessage: (text: string) => Promise<void>
  updateFieldValue: (fieldId: string, value: string) => void
  goToStep: (direction: 'next' | 'back') => void
  undoLastChange: () => void
  setSandboxPaused: (paused: boolean) => void
  setSandboxMinimized: (minimized: boolean) => void
  refreshSandbox: () => void
  confirmSubmit: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() =>
    loadActiveId(loadSessions()),
  )
  const [isAgentBusy, setIsAgentBusy] = useState(false)
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null)
  const [, setFieldHistory] = useState<Record<string, string>[]>([])

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  )

  const updateActiveSession = useCallback(
    (updater: (session: ChatSession) => ChatSession) => {
      if (!activeSessionId) return
      setSessions((prev) => {
        const next = prev.map((s) =>
          s.id === activeSessionId ? { ...updater(s), updatedAt: Date.now() } : s,
        )
        persist(next, activeSessionId)
        return next
      })
    },
    [activeSessionId],
  )

  const createSession = useCallback(() => {
    const session = createEmptyChatSession()
    setSessions((prev) => {
      const next = [session, ...prev]
      persist(next, session.id)
      return next
    })
    setActiveSessionId(session.id)
    setActiveFieldId(null)
    return session.id
  }, [])

  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id)
    localStorage.setItem(ACTIVE_KEY, id)
    setActiveFieldId(null)
  }, [])

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id)
        const nextActive =
          activeSessionId === id ? (next[0]?.id ?? null) : activeSessionId
        setActiveSessionId(nextActive)
        setActiveFieldId(null)
        persist(next, nextActive)
        return next
      })
    },
    [activeSessionId],
  )

  const renameSession = useCallback(
    (id: string, title: string) => {
      const trimmed = title.trim() || 'New chat'
      setSessions((prev) => {
        const next = prev.map((s) =>
          s.id === id ? { ...s, title: trimmed, updatedAt: Date.now() } : s,
        )
        persist(next, activeSessionId)
        return next
      })
    },
    [activeSessionId],
  )

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || !activeSessionId) return

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      }

      updateActiveSession((s) => ({
        ...s,
        title: s.title === 'New chat' ? trimmed.slice(0, 48) : s.title,
        messages: [...s.messages, userMsg],
      }))

      setIsAgentBusy(true)
      try {
        const response = await sendChatQuery(trimmed, activeSessionId)
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.message,
          timestamp: Date.now(),
          simplifiedUi: response.simplifiedUi,
        }

        updateActiveSession((s) => {
          let sandbox = { ...s.sandbox }
          if (response.url) sandbox = { ...sandbox, url: response.url }
          if (response.streamUrl) sandbox = { ...sandbox, streamUrl: response.streamUrl }
          if (response.contextLabel) sandbox = { ...sandbox, contextLabel: response.contextLabel }

          return {
            ...s,
            messages: [...s.messages, assistantMsg],
            simplifiedUi: response.simplifiedUi ?? s.simplifiedUi,
            sandbox,
            actionLog: response.actionLog ?? s.actionLog,
          }
        })

        if (response.simplifiedUi?.fields[0]) {
          setActiveFieldId(response.simplifiedUi.fields[0].id)
        }
      } catch {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            'I could not reach the server. Start your backend, or check VITE_API_URL in .env.',
          timestamp: Date.now(),
        }
        updateActiveSession((s) => ({
          ...s,
          messages: [...s.messages, errorMsg],
        }))
      } finally {
        setIsAgentBusy(false)
      }
    },
    [activeSessionId, updateActiveSession],
  )

  const updateFieldValue = useCallback(
    (fieldId: string, value: string) => {
      updateActiveSession((s) => {
        if (!s.simplifiedUi) return s
        const previous =
          s.simplifiedUi.fields.find((f) => f.id === fieldId)?.value ?? ''
        setFieldHistory((h) => [...h, { [fieldId]: previous }])
        const fields = s.simplifiedUi.fields.map((f) =>
          f.id === fieldId ? { ...f, value } : f,
        )
        sendBrowserEvent(
          { type: 'input', targetId: fieldId, payload: { value } },
          activeSessionId!,
        )
        return {
          ...s,
          simplifiedUi: { ...s.simplifiedUi, fields },
        }
      })
    },
    [updateActiveSession, activeSessionId],
  )

  const goToStep = useCallback(
    (direction: 'next' | 'back') => {
      updateActiveSession((s) => {
        if (!s.simplifiedUi?.totalSteps) return s
        const current = s.simplifiedUi.currentStep ?? 1
        const next =
          direction === 'next'
            ? Math.min(current + 1, s.simplifiedUi.totalSteps!)
            : Math.max(current - 1, 1)
        return {
          ...s,
          simplifiedUi: { ...s.simplifiedUi, currentStep: next },
        }
      })
    },
    [updateActiveSession],
  )

  const undoLastChange = useCallback(() => {
    setFieldHistory((h) => {
      const last = h[h.length - 1]
      if (!last) return h
      const [fieldId, value] = Object.entries(last)[0]
      updateActiveSession((s) => {
        if (!s.simplifiedUi) return s
        return {
          ...s,
          simplifiedUi: {
            ...s.simplifiedUi,
            fields: s.simplifiedUi.fields.map((f) =>
              f.id === fieldId ? { ...f, value } : f,
            ),
          },
        }
      })
      return h.slice(0, -1)
    })
  }, [updateActiveSession])

  const value = useMemo(
    () => ({
      sessions,
      activeSessionId,
      messages: activeSession?.messages ?? [],
      simplifiedUi: activeSession?.simplifiedUi ?? null,
      sandbox: activeSession?.sandbox ?? emptySandbox(),
      actionLog: activeSession?.actionLog ?? [],
      isAgentBusy,
      activeFieldId,
      setActiveFieldId,
      createSession,
      selectSession,
      deleteSession,
      renameSession,
      sendMessage,
      updateFieldValue,
      goToStep,
      undoLastChange,
      setSandboxPaused: (paused: boolean) =>
        updateActiveSession((s) => ({
          ...s,
          sandbox: { ...s.sandbox, paused },
        })),
      setSandboxMinimized: (minimized: boolean) =>
        updateActiveSession((s) => ({
          ...s,
          sandbox: { ...s.sandbox, minimized },
        })),
      refreshSandbox: () => {
        if (activeSessionId) {
          sendBrowserEvent({ type: 'scroll', payload: { refresh: true } }, activeSessionId)
        }
      },
      confirmSubmit: () => {
        if (activeSessionId) sendBrowserEvent({ type: 'submit' }, activeSessionId)
      },
    }),
    [
      sessions,
      activeSessionId,
      activeSession,
      isAgentBusy,
      activeFieldId,
      createSession,
      selectSession,
      deleteSession,
      renameSession,
      sendMessage,
      updateFieldValue,
      goToStep,
      undoLastChange,
      updateActiveSession,
    ],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
