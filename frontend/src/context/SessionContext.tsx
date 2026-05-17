import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ChatMessage, ChatSession, SandboxSession, SimplifiedUiState } from '../types'
import {
  checkHealth,
  createChatSession,
  createUserSession,
  deleteChatSession,
  fetchSandboxPages,
  getChatSessionDetail,
  getUserSession,
  listChatSessions,
  postAgentChat,
  postAgentSubmitForm,
  postSandboxEvent,
} from '../api/backend'
import {
  buildSandboxView,
  latestFormFromStates,
  mapAgentChatResponse,
  type AppIntentAction,
} from '../api/mapResponse'

const STORAGE = {
  sessions: 'clearpath-sessions-v3',
  active: 'clearpath-active-session',
  user: 'clearpath-user-session-id',
} as const

const emptySandbox = (): SandboxSession => ({
  pages: [],
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

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE.sessions)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatSession[]
    return parsed.map((s) => ({
      ...s,
      sandbox: { ...emptySandbox(), ...s.sandbox, pages: s.sandbox?.pages ?? [] },
    }))
  } catch {
    return []
  }
}

function loadActiveId(sessions: ChatSession[]): string | null {
  const stored = localStorage.getItem(STORAGE.active)
  if (stored && sessions.some((s) => s.id === stored)) return stored
  return sessions[0]?.id ?? null
}

function persist(sessions: ChatSession[], activeId: string | null) {
  localStorage.setItem(STORAGE.sessions, JSON.stringify(sessions))
  if (activeId) localStorage.setItem(STORAGE.active, activeId)
  else localStorage.removeItem(STORAGE.active)
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
  actionLog: ChatSession['actionLog']
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
  confirmSubmit: () => Promise<void>
  syncWithBackend: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() =>
    loadActiveId(loadSessions()),
  )
  const [userSessionId, setUserSessionId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE.user),
  )
  const [apiStatus, setApiStatus] = useState<SessionApiStatus>('idle')
  const [isAgentBusy, setIsAgentBusy] = useState(false)
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null)
  const [, setFieldHistory] = useState<Record<string, string>[]>([])
  const createSessionInFlight = useRef(false)
  const syncInFlight = useRef(false)

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  )

  const patchActive = useCallback(
    (updater: (s: ChatSession) => ChatSession) => {
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

  const ensureUserSession = useCallback(async (): Promise<string> => {
    const stored = localStorage.getItem(STORAGE.user)
    if (stored) {
      try {
        await getUserSession(stored)
        setUserSessionId(stored)
        return stored
      } catch {
        localStorage.removeItem(STORAGE.user)
      }
    }
    const user = await createUserSession()
    localStorage.setItem(STORAGE.user, user.id)
    setUserSessionId(user.id)
    return user.id
  }, [])

  const loadChatFromBackend = useCallback(
    async (chatSessionId: string) => {
      if (apiStatus !== 'connected') return
      try {
        const [detail, { pages, activePageId }] = await Promise.all([
          getChatSessionDetail(chatSessionId),
          fetchSandboxPages(chatSessionId),
        ])
        patchActive((s) => ({
          ...s,
          simplifiedUi: latestFormFromStates(detail.chat_session_states) ?? s.simplifiedUi,
          sandbox: {
            ...s.sandbox,
            ...buildSandboxView(chatSessionId, pages, activePageId, detail.page_urls),
          },
        }))
      } catch {
        /* no browser context yet */
      }
    },
    [apiStatus, patchActive],
  )

  const syncWithBackend = useCallback(async () => {
    if (syncInFlight.current) return
    syncInFlight.current = true
    setApiStatus('connecting')
    try {
      if (!(await checkHealth())) {
        setApiStatus('offline')
        return
      }
      const uid = await ensureUserSession()
      const chatIds = await listChatSessions(uid)
      setSessions((prev) => {
        const byId = new Map(prev.map((s) => [s.id, s]))
        const next = chatIds.map((id) => byId.get(String(id)) ?? createEmptyChatSession(String(id)))
        const nextActive = loadActiveId(next) ?? next[0]?.id ?? null
        setActiveSessionId(nextActive)
        persist(next, nextActive)
        return next
      })
      setApiStatus('connected')
    } catch {
      setApiStatus('error')
    } finally {
      syncInFlight.current = false
    }
  }, [ensureUserSession])

  useEffect(() => {
    void syncWithBackend()
  }, [syncWithBackend])

  useEffect(() => {
    if (activeSessionId && apiStatus === 'connected') {
      void loadChatFromBackend(activeSessionId)
    }
  }, [activeSessionId, apiStatus, loadChatFromBackend])

  const createSession = useCallback(async () => {
    if (createSessionInFlight.current) {
      return activeSessionId ?? ''
    }
    createSessionInFlight.current = true
    try {
      const healthy = await checkHealth()

      if (healthy) {
        try {
          const uid = userSessionId ?? (await ensureUserSession())
          const created = await createChatSession(uid)
          const session = createEmptyChatSession(String(created.id))
          setSessions((prev) => {
            const next = [session, ...prev.filter((s) => s.id !== session.id)]
            persist(next, session.id)
            return next
          })
          setActiveSessionId(session.id)
          setActiveFieldId(null)
          setApiStatus('connected')
          return session.id
        } catch {
          setApiStatus('error')
          throw new Error('Could not create chat session on the server.')
        }
      }

      // Backend unreachable — local-only chat (offline mode)
      setApiStatus('offline')
      const session = createEmptyChatSession()
      setSessions((prev) => {
        const next = [session, ...prev]
        persist(next, session.id)
        return next
      })
      setActiveSessionId(session.id)
      setActiveFieldId(null)
      return session.id
    } finally {
      createSessionInFlight.current = false
    }
  }, [userSessionId, ensureUserSession, activeSessionId])

  const deleteSession = useCallback(
    async (id: string) => {
      if (apiStatus === 'connected') {
        try {
          const uid = userSessionId ?? (await ensureUserSession())
          await deleteChatSession(uid, id)
        } catch {
          setApiStatus('error')
        }
      }
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id)
        const nextActive = activeSessionId === id ? (next[0]?.id ?? null) : activeSessionId
        setActiveSessionId(nextActive)
        setActiveFieldId(null)
        persist(next, nextActive)
        return next
      })
    },
    [apiStatus, userSessionId, ensureUserSession, activeSessionId],
  )

  const handleAppIntent = useCallback(
    async (intent: AppIntentAction) => {
      switch (intent.type) {
        case 'switch_conversation_tab':
          if (intent.targetId) {
            setActiveSessionId(intent.targetId)
            localStorage.setItem(STORAGE.active, intent.targetId)
            setActiveFieldId(null)
            await loadChatFromBackend(intent.targetId)
          }
          break
        case 'delete_conversation':
          if (intent.targetId) await deleteSession(intent.targetId)
          break
        case 'create_conversation':
          await createSession()
          break
        case 'minimize_browser':
          patchActive((s) => ({ ...s, sandbox: { ...s.sandbox, minimized: true } }))
          break
        case 'full_screen_browser':
          patchActive((s) => ({ ...s, sandbox: { ...s.sandbox, minimized: false } }))
          break
        default:
          break
      }
    },
    [createSession, deleteSession, loadChatFromBackend, patchActive],
  )

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || !activeSessionId) return

      patchActive((s) => ({
        ...s,
        title: s.title === 'New chat' ? trimmed.slice(0, 48) : s.title,
        messages: [
          ...s.messages,
          { id: crypto.randomUUID(), role: 'user', content: trimmed, timestamp: Date.now() },
        ],
      }))

      setIsAgentBusy(true)
      try {
        const raw = await postAgentChat(trimmed, activeSessionId)
        const reply = mapAgentChatResponse(raw)
        if (reply.appIntent) await handleAppIntent(reply.appIntent)

        const { pages, activePageId } = await fetchSandboxPages(activeSessionId)
        const sandbox = buildSandboxView(activeSessionId, pages, activePageId, [])
        if (reply.confirmationUrl) {
          sandbox.url = reply.confirmationUrl
          sandbox.contextLabel = 'Confirmation'
        }

        const simplifiedUi =
          reply.simplifiedUi ??
          (reply.formReferenceId && activeSession?.simplifiedUi
            ? { ...activeSession.simplifiedUi, formReferenceId: reply.formReferenceId }
            : activeSession?.simplifiedUi ?? null)

        patchActive((s) => ({
          ...s,
          messages: [
            ...s.messages,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: reply.message,
              timestamp: Date.now(),
              simplifiedUi: simplifiedUi ?? undefined,
            },
          ],
          simplifiedUi,
          sandbox: { ...s.sandbox, ...sandbox },
        }))

        if (simplifiedUi?.fields[0]) setActiveFieldId(simplifiedUi.fields[0].id)
      } catch {
        patchActive((s) => ({
          ...s,
          messages: [
            ...s.messages,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content:
                apiStatus === 'connected'
                  ? 'Something went wrong. Create a new chat first, then try again.'
                  : 'I could not reach the server. Start the backend and Redis, then refresh.',
              timestamp: Date.now(),
            },
          ],
        }))
      } finally {
        setIsAgentBusy(false)
      }
    },
    [activeSessionId, activeSession?.simplifiedUi, apiStatus, handleAppIntent, patchActive],
  )

  const updateFieldValue = useCallback(
    (fieldId: string, value: string) => {
      if (!activeSessionId || !activeSession?.simplifiedUi) return
      const field = activeSession.simplifiedUi.fields.find((f) => f.id === fieldId)
      if (!field) return

      setFieldHistory((h) => [...h, { [fieldId]: field.value }])
      patchActive((s) => ({
        ...s,
        simplifiedUi: {
          ...s.simplifiedUi!,
          fields: s.simplifiedUi!.fields.map((f) =>
            f.id === fieldId ? { ...f, value } : f,
          ),
        },
      }))

      if (/^https?:\/\//i.test(value)) {
        void postSandboxEvent(
          { type: 'input', targetId: fieldId, payload: { value } },
          activeSessionId,
        )
      }
    },
    [activeSessionId, activeSession?.simplifiedUi, patchActive],
  )

  const goToStep = useCallback(
    (direction: 'next' | 'back') => {
      patchActive((s) => {
        if (!s.simplifiedUi?.totalSteps) return s
        const current = s.simplifiedUi.currentStep ?? 1
        const total = s.simplifiedUi.totalSteps
        const nextStep =
          direction === 'next' ? Math.min(current + 1, total) : Math.max(current - 1, 1)
        return {
          ...s,
          simplifiedUi: { ...s.simplifiedUi, currentStep: nextStep },
        }
      })
    },
    [patchActive],
  )

  const undoLastChange = useCallback(() => {
    setFieldHistory((h) => {
      const last = h[h.length - 1]
      if (!last) return h
      const [fieldId, value] = Object.entries(last)[0]
      patchActive((s) => {
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
  }, [patchActive])

  const selectSession = useCallback(
    (id: string) => {
      setActiveSessionId(id)
      localStorage.setItem(STORAGE.active, id)
      setActiveFieldId(null)
    },
    [],
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

  const confirmSubmit = useCallback(async () => {
    if (!activeSessionId) return
    const formId = activeSession?.simplifiedUi?.formReferenceId
    if (!formId) return

    setIsAgentBusy(true)
    try {
      await postAgentSubmitForm(activeSessionId, formId)
      patchActive((s) => ({
        ...s,
        messages: [
          ...s.messages,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Form submitted to the website.',
            timestamp: Date.now(),
          },
        ],
      }))
      await loadChatFromBackend(activeSessionId)
    } catch {
      patchActive((s) => ({
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
  }, [activeSessionId, activeSession?.simplifiedUi, patchActive, loadChatFromBackend])

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
        patchActive((s) => ({ ...s, sandbox: { ...s.sandbox, paused } })),
      setSandboxMinimized: (minimized: boolean) =>
        patchActive((s) => ({ ...s, sandbox: { ...s.sandbox, minimized } })),
      refreshSandbox: () => {
        if (activeSessionId) {
          void postSandboxEvent(
            { type: 'scroll', payload: { refresh: true } },
            activeSessionId,
          )
          void loadChatFromBackend(activeSessionId)
        }
      },
      confirmSubmit,
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
      syncWithBackend,
      patchActive,
      loadChatFromBackend,
      confirmSubmit,
    ],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
