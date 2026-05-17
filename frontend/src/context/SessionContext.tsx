import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
import {
  checkBackendHealth,
  createMessageSession,
  createUserSession,
  deleteMessageSession,
  getChatSessionDetail,
  getUserSession,
  listMessageSessions,
} from '../api/sessionClient'
import {
  fetchSandboxPages,
  getSandboxStreamUrl,
  sendBrowserEvent,
  sendChatQuery,
  submitAgentForm,
} from '../api/client'
import { latestFormFromUiStates } from '../api/uiAdapter'
import type { BackendAppIntent } from '../api/agentTypes'

const SESSIONS_KEY = 'clearpath-sessions-v2'
const ACTIVE_KEY = 'clearpath-active-session'
const USER_SESSION_KEY = 'clearpath-user-session-id'

const emptySandbox = (): SandboxSession => ({
  pages: [],
  paused: false,
  minimized: false,
})

function normalizeSandbox(sandbox: Partial<SandboxSession> | undefined): SandboxSession {
  return {
    ...emptySandbox(),
    ...sandbox,
    pages: sandbox?.pages ?? [],
  }
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ChatSession[]
      if (parsed.length > 0) {
        return parsed.map((s) => ({
          ...s,
          sandbox: normalizeSandbox(s.sandbox),
        }))
      }
    }
  } catch {
    /* ignore */
  }
  return []
}

function welcomeMessage(): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      'What do you need help with? Tell me the website or form you want to complete.',
    timestamp: Date.now(),
  }
}

export function createEmptyChatSession(id?: string): ChatSession {
  return {
    id: id ?? crypto.randomUUID(),
    title: 'New chat',
    messages: [welcomeMessage()],
    simplifiedUi: null,
    sandbox: emptySandbox(),
    actionLog: [],
    updatedAt: Date.now(),
  }
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

export type SessionApiStatus = 'idle' | 'connecting' | 'connected' | 'offline' | 'error'

type SessionContextValue = {
  sessions: ChatSession[]
  activeSessionId: string | null
  userSessionId: string | null
  apiStatus: SessionApiStatus
  messages: ChatMessage[]
  simplifiedUi: SimplifiedUiState | null
  sandbox: SandboxSession
  actionLog: ActionLogItem[]
  isAgentBusy: boolean
  activeFieldId: string | null
  setActiveFieldId: (id: string | null) => void
  createSession: () => Promise<string>
  selectSession: (id: string) => void
  deleteSession: (id: string) => Promise<void>
  renameSession: (id: string, title: string) => void
  sendMessage: (text: string) => Promise<void>
  updateFieldValue: (fieldId: string, value: string) => void
  goToStep: (direction: 'next' | 'back') => void
  undoLastChange: () => void
  setSandboxPaused: (paused: boolean) => void
  setSandboxMinimized: (minimized: boolean) => void
  refreshSandbox: () => void
  confirmSubmit: () => void
  syncWithBackend: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() =>
    loadActiveId(loadSessions()),
  )
  const [userSessionId, setUserSessionId] = useState<string | null>(() =>
    localStorage.getItem(USER_SESSION_KEY),
  )
  const [apiStatus, setApiStatus] = useState<SessionApiStatus>('idle')
  const [isAgentBusy, setIsAgentBusy] = useState(false)
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null)
  const [, setFieldHistory] = useState<Record<string, string>[]>([])

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  )

  const ensureUserSession = useCallback(async (): Promise<string> => {
    const stored = localStorage.getItem(USER_SESSION_KEY)
    if (stored) {
      try {
        await getUserSession(stored)
        setUserSessionId(stored)
        return stored
      } catch {
        localStorage.removeItem(USER_SESSION_KEY)
      }
    }
    const user = await createUserSession()
    localStorage.setItem(USER_SESSION_KEY, user.id)
    setUserSessionId(user.id)
    return user.id
  }, [])

  const syncWithBackend = useCallback(async () => {
    setApiStatus('connecting')
    const healthy = await checkBackendHealth()
    if (!healthy) {
      setApiStatus('offline')
      return
    }

    try {
      const uid = await ensureUserSession()
      const chatIds = await listMessageSessions(uid)
      setSessions((prev) => {
        const byId = new Map(prev.map((s) => [s.id, s]))
        const merged: ChatSession[] = chatIds.map(
          (id) => byId.get(id) ?? createEmptyChatSession(id),
        )
        const next = merged.length > 0 ? merged : prev
        const nextActive = loadActiveId(next) ?? next[0]?.id ?? null
        setActiveSessionId(nextActive)
        persist(next, nextActive)
        return next
      })
      setApiStatus('connected')
    } catch {
      setApiStatus('error')
    }
  }, [ensureUserSession])

  useEffect(() => {
    void syncWithBackend()
  }, [syncWithBackend])

  const hydrateSessionFromBackend = useCallback(async (chatSessionId: string) => {
    if (apiStatus !== 'connected') return

    try {
      const [detail, { pages, activePageId }] = await Promise.all([
        getChatSessionDetail(chatSessionId),
        fetchSandboxPages(chatSessionId),
      ])

      const activePage =
        pages.find((p) => p.isActive) ??
        pages.find((p) => p.id === activePageId) ??
        pages[0]
      const fallbackUrl = detail.page_urls[0]
      const latestForm = latestFormFromUiStates(detail.chat_session_states)

      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id !== chatSessionId) return s
          const streamUrl =
            pages.length > 0 ? getSandboxStreamUrl(chatSessionId) : s.sandbox.streamUrl
          return {
            ...s,
            simplifiedUi: latestForm?.simplifiedUi ?? s.simplifiedUi,
            sandbox: {
              ...s.sandbox,
              pages,
              activePageId: activePageId ?? undefined,
              streamUrl,
              url: activePage?.url ?? fallbackUrl ?? s.sandbox.url,
              contextLabel: activePage?.title ?? s.sandbox.contextLabel,
            },
          }
        })
        persist(next, activeSessionId)
        return next
      })
    } catch {
      /* best effort */
    }
  }, [apiStatus, activeSessionId])

  useEffect(() => {
    if (!activeSessionId || apiStatus !== 'connected') return
    void hydrateSessionFromBackend(activeSessionId)
    const interval = window.setInterval(() => {
      void hydrateSessionFromBackend(activeSessionId)
    }, 3000)
    return () => window.clearInterval(interval)
  }, [activeSessionId, apiStatus, hydrateSessionFromBackend])

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

  const createSession = useCallback(async () => {
    const healthy = await checkBackendHealth()
    if (healthy) {
      try {
        const uid = userSessionId ?? (await ensureUserSession())
        setUserSessionId(uid)
        const created = await createMessageSession(uid)
        const session = createEmptyChatSession(String(created.id))
        setSessions((prev) => {
          const next = [session, ...prev]
          persist(next, session.id)
          return next
        })
        setActiveSessionId(session.id)
        setActiveFieldId(null)
        setApiStatus('connected')
        return session.id
      } catch {
        setApiStatus('error')
      }
    } else {
      setApiStatus('offline')
    }

    const session = createEmptyChatSession()
    setSessions((prev) => {
      const next = [session, ...prev]
      persist(next, session.id)
      return next
    })
    setActiveSessionId(session.id)
    setActiveFieldId(null)
    return session.id
  }, [userSessionId, ensureUserSession])

  const selectSession = useCallback(
    (id: string) => {
      setActiveSessionId(id)
      localStorage.setItem(ACTIVE_KEY, id)
      setActiveFieldId(null)
      void hydrateSessionFromBackend(id)
    },
    [hydrateSessionFromBackend],
  )

  const deleteSession = useCallback(
    async (id: string) => {
      if (await checkBackendHealth()) {
        try {
          const uid = userSessionId ?? (await ensureUserSession())
          await deleteMessageSession(uid, id)
          setApiStatus('connected')
        } catch {
          setApiStatus('error')
        }
      }

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
    [activeSessionId, userSessionId, ensureUserSession],
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

  const handleAppIntent = useCallback(
    async (intent: BackendAppIntent) => {
      switch (intent.type) {
        case 'switch_conversation_tab':
          if (intent.id) selectSession(String(intent.id))
          break
        case 'delete_conversation':
          if (intent.id) await deleteSession(String(intent.id))
          break
        case 'create_conversation':
          await createSession()
          break
        case 'minimize_browser':
          updateActiveSession((s) => ({
            ...s,
            sandbox: { ...s.sandbox, minimized: true },
          }))
          break
        case 'full_screen_browser':
          updateActiveSession((s) => ({
            ...s,
            sandbox: { ...s.sandbox, minimized: false },
          }))
          break
        case 'open_settings':
          break
        default:
          break
      }
    },
    [selectSession, deleteSession, createSession, updateActiveSession],
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

        if (response.appIntent) {
          await handleAppIntent(response.appIntent)
        }

        const nextSimplifiedUi =
          response.simplifiedUi != null
            ? {
                ...response.simplifiedUi,
                formReferenceId:
                  response.formReferenceId ?? response.simplifiedUi.formReferenceId,
              }
            : undefined

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.message,
          timestamp: Date.now(),
          simplifiedUi: nextSimplifiedUi ?? undefined,
        }

        const { pages, activePageId } = await fetchSandboxPages(activeSessionId)
        const activePage =
          pages.find((p) => p.isActive) ??
          pages.find((p) => p.id === activePageId) ??
          pages[0]

        updateActiveSession((s) => {
          let sandbox = { ...s.sandbox, pages, activePageId: activePageId ?? undefined }
          if (pages.length > 0) {
            sandbox = {
              ...sandbox,
              streamUrl: getSandboxStreamUrl(activeSessionId),
              url: activePage?.url ?? sandbox.url,
              contextLabel: activePage?.title ?? sandbox.contextLabel,
            }
          }
          if (response.confirmationDocumentUrl) {
            sandbox = {
              ...sandbox,
              url: response.confirmationDocumentUrl,
              contextLabel: 'Confirmation',
            }
          }

          return {
            ...s,
            messages: [...s.messages, assistantMsg],
            simplifiedUi: nextSimplifiedUi ?? s.simplifiedUi,
            sandbox,
          }
        })

        if (nextSimplifiedUi?.fields[0]) {
          setActiveFieldId(nextSimplifiedUi.fields[0].id)
        }
      } catch {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            apiStatus === 'connected'
              ? 'Something went wrong talking to the agent. Make sure Redis is running and you created a new chat first.'
              : 'I could not reach the server. Start your backend and Redis, or check VITE_API_URL in .env.',
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
    [activeSessionId, updateActiveSession, apiStatus, handleAppIntent],
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
      userSessionId,
      apiStatus,
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
      syncWithBackend,
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
      confirmSubmit: async () => {
        if (!activeSessionId) return
        const formId = activeSession?.simplifiedUi?.formReferenceId
        if (!formId) {
          sendBrowserEvent({ type: 'submit' }, activeSessionId)
          return
        }
        setIsAgentBusy(true)
        try {
          const response = await submitAgentForm(activeSessionId, formId)
          const assistantMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: response.message,
            timestamp: Date.now(),
          }
          updateActiveSession((s) => ({
            ...s,
            messages: [...s.messages, assistantMsg],
            simplifiedUi: response.simplifiedUi ?? null,
          }))
          void hydrateSessionFromBackend(activeSessionId)
        } catch {
          updateActiveSession((s) => ({
            ...s,
            messages: [
              ...s.messages,
              {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: 'Form submission failed. Please try again.',
                timestamp: Date.now(),
              },
            ],
          }))
        } finally {
          setIsAgentBusy(false)
        }
      },
    }),
    [
      sessions,
      activeSessionId,
      userSessionId,
      apiStatus,
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
      syncWithBackend,
      hydrateSessionFromBackend,
    ],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
