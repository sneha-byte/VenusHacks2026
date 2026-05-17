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
  openSandboxUrl,
  postSandboxEvent,
  sandboxStreamUrl,
} from '../api/backend'
import {
  buildSandboxView,
  latestFormFromStates,
  mapAgentChatResponse,
  type AppIntentAction,
} from '../api/mapResponse'
import { extractFirstUrl, previewLabelForUrl } from '../utils/url'
import { UCI_FORM_TITLE, UCI_FORM_URL } from '../data/uciPostCourseForm'
import {
  GUIDED_QUESTIONS,
  GUIDED_TOTAL,
  buildSubmitConfirmPrompt,
  buildSummary,
  formatAnswerRecord,
  formatQuestion,
  introMessages,
  normalizeChoice,
  normalizeScale,
  normalizeYesNo,
  surveyMsg,
} from '../lib/guidedSurveyLogic'

const STORAGE = {
  sessions: 'clearpath-sessions-v4',
  active: 'clearpath-active-session',
  user: 'clearpath-user-session-id',
} as const

const emptySandbox = (): SandboxSession => ({
  pages: [],
  paused: false,
  minimized: false,
  showPreview: false,
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
      guidedSurvey: s.guidedSurvey ?? null,
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
  openPreviewUrl: (url: string) => Promise<void>
  updateFieldValue: (fieldId: string, value: string) => void
  goToStep: (direction: 'next' | 'back') => void
  undoLastChange: () => void
  setSandboxPaused: (paused: boolean) => void
  setSandboxMinimized: (minimized: boolean) => void
  refreshSandbox: () => void
  confirmSubmit: () => Promise<void>
  syncWithBackend: () => Promise<void>
  isCreatingSession: boolean
  guidedSurveyActive: boolean
  guidedSurveyAwaitingSubmit: boolean
  guidedSurveySubmitted: boolean
  guidedSurveyStep: number
  guidedSurveyTotal: number
  startGuidedSurvey: (formUrl?: string) => Promise<void>
  submitGuidedSurveyAnswer: (text: string) => void
  exitGuidedSurvey: () => void
  resumeGuidedSurvey: () => void
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
  const ensuredChatRef = useRef(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)

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

  const patchSessionById = useCallback((sessionId: string, updater: (s: ChatSession) => ChatSession) => {
    setSessions((prev) => {
      const next = prev.map((s) =>
        s.id === sessionId ? { ...updater(s), updatedAt: Date.now() } : s,
      )
      persist(next, sessionId)
      return next
    })
    setActiveSessionId(sessionId)
  }, [])

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
        const [detail] = await Promise.all([
          getChatSessionDetail(chatSessionId),
          fetchSandboxPages(chatSessionId),
        ])
        patchActive((s) => ({
          ...s,
          simplifiedUi: latestFormFromStates(detail.chat_session_states) ?? s.simplifiedUi,
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

  const addLocalSession = useCallback(() => {
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
      return activeSessionId ?? sessions[0]?.id ?? addLocalSession()
    }
    createSessionInFlight.current = true
    setIsCreatingSession(true)
    try {
      const healthy = await checkHealth()

      if (healthy) {
        try {
          const uid = userSessionId ?? (await ensureUserSession())
          const created = await createChatSession(uid)
          const session = {
            ...createEmptyChatSession(String(created.id)),
            sandbox: emptySandbox(),
          }
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
          return addLocalSession()
        }
      }

      setApiStatus('offline')
      return addLocalSession()
    } finally {
      createSessionInFlight.current = false
      setIsCreatingSession(false)
    }
  }, [userSessionId, ensureUserSession, activeSessionId, sessions, addLocalSession])

  useEffect(() => {
    if (apiStatus === 'connecting' || ensuredChatRef.current) return
    if (activeSessionId && sessions.some((s) => s.id === activeSessionId)) return

    ensuredChatRef.current = true
    if (sessions.length > 0) {
      const id = sessions[0].id
      setActiveSessionId(id)
      persist(sessions, id)
      return
    }
    void createSession()
  }, [apiStatus, activeSessionId, sessions, createSession])

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

  const openPreviewUrl = useCallback(
    async (url: string) => {
      if (apiStatus !== 'connected') {
        await syncWithBackend()
      }

      let sessionId = activeSessionId
      if (!sessionId || apiStatus !== 'connected') {
        sessionId = await createSession()
        if (!sessionId) return
      }
      const label = previewLabelForUrl(url)

      patchSessionById(sessionId, (s) => ({
        ...s,
        sandbox: {
          ...emptySandbox(),
          showPreview: true,
          url,
          contextLabel: label,
          paused: false,
        },
      }))

      if (!(await checkHealth())) return

      let ok = await openSandboxUrl(sessionId, url)
      if (!ok) {
        ok = await postSandboxEvent({ type: 'navigate', payload: { url } }, sessionId)
      }

      const { pages, activePageId } = await fetchSandboxPages(sessionId)
      const view = buildSandboxView(sessionId, pages, activePageId, [url])
      patchSessionById(sessionId, (s) => ({
        ...s,
        sandbox: {
          showPreview: true,
          url: view.url ?? url,
          contextLabel: view.contextLabel ?? label,
          pages: view.pages,
          activePageId: view.activePageId,
          streamUrl: ok ? view.streamUrl ?? sandboxStreamUrl(sessionId) : undefined,
          paused: false,
          minimized: false,
        },
      }))
    },
    [activeSessionId, apiStatus, createSession, patchSessionById, syncWithBackend],
  )

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      let sessionId = activeSessionId
      if (!sessionId) {
        sessionId = await createSession()
        if (!sessionId) return
      }

      const pastedUrl = extractFirstUrl(trimmed)

      patchSessionById(sessionId, (s) => ({
        ...s,
        title: s.title === 'New chat' ? trimmed.slice(0, 48) : s.title,
        messages: [
          ...s.messages,
          { id: crypto.randomUUID(), role: 'user', content: trimmed, timestamp: Date.now() },
        ],
      }))

      if (pastedUrl) {
        await openPreviewUrl(pastedUrl)
        if (apiStatus !== 'connected') {
          patchSessionById(sessionId, (s) => ({
            ...s,
            messages: [
              ...s.messages,
              {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: 'Opening your form in the preview panel…',
                timestamp: Date.now(),
              },
            ],
          }))
          return
        }
      } else if (apiStatus !== 'connected') {
        patchSessionById(sessionId, (s) => ({
          ...s,
          messages: [
            ...s.messages,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: 'Paste a form link in chat to open it in the preview. Start the backend for full AI help.',
              timestamp: Date.now(),
            },
          ],
        }))
        return
      }

      setIsAgentBusy(true)
      try {
        const raw = await postAgentChat(trimmed, sessionId)
        const reply = mapAgentChatResponse(raw)
        if (reply.appIntent) await handleAppIntent(reply.appIntent)

        const simplifiedUi =
          reply.simplifiedUi ??
          (reply.formReferenceId && activeSession?.simplifiedUi
            ? { ...activeSession.simplifiedUi, formReferenceId: reply.formReferenceId }
            : activeSession?.simplifiedUi ?? null)

        patchSessionById(sessionId, (s) => ({
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
          sandbox: s.sandbox,
        }))

        if (simplifiedUi?.fields[0]) setActiveFieldId(simplifiedUi.fields[0].id)
      } catch {
        patchSessionById(sessionId, (s) => ({
          ...s,
          messages: [
            ...s.messages,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content:
                apiStatus === 'connected'
                  ? 'Something went wrong. Try again or paste your link for preview only.'
                  : 'I could not reach the server. Start the backend and Redis, then click Retry.',
              timestamp: Date.now(),
            },
          ],
        }))
      } finally {
        setIsAgentBusy(false)
      }
    },
    [
      activeSessionId,
      activeSession?.simplifiedUi,
      apiStatus,
      createSession,
      handleAppIntent,
      openPreviewUrl,
      patchSessionById,
    ],
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

  const guidedSurveyActive = activeSession?.guidedSurvey?.active ?? false
  const guidedSurveyAwaitingSubmit =
    activeSession?.guidedSurvey?.awaitingSubmitConfirm ?? false
  const guidedSurveySubmitted = activeSession?.guidedSurvey?.submitted ?? false
  const guidedSurveyStep = activeSession?.guidedSurvey?.stepIndex ?? 0

  const startGuidedSurvey = useCallback(
    async (formUrl: string = UCI_FORM_URL) => {
      let sessionId = activeSessionId
      if (!sessionId) {
        sessionId = await createSession()
      }
      if (!sessionId) return

      patchSessionById(sessionId, (s) => ({
        ...s,
        title: UCI_FORM_TITLE.slice(0, 48),
        messages: introMessages(),
        guidedSurvey: {
          formUrl,
          answers: s.guidedSurvey?.answers ?? {},
          active: true,
          stepIndex: 0,
        },
      }))
    },
    [activeSessionId, createSession, patchSessionById],
  )

  const exitGuidedSurvey = useCallback(() => {
    if (!activeSessionId || !activeSession?.guidedSurvey) return
    patchActive((s) => ({
      ...s,
      guidedSurvey: {
        ...s.guidedSurvey!,
        active: false,
      },
      messages: [
        ...s.messages,
        surveyMsg(
          'assistant',
          'Survey paused. Your questions and answers are saved in this chat — scroll up anytime to review.',
        ),
      ],
    }))
  }, [activeSessionId, activeSession?.guidedSurvey, patchActive])

  const resumeGuidedSurvey = useCallback(() => {
    if (!activeSessionId || !activeSession?.guidedSurvey) return
    const gs = activeSession.guidedSurvey
    if (gs.submitted) return

    if (gs.stepIndex >= GUIDED_TOTAL && Object.keys(gs.answers).length > 0) {
      const summary = buildSummary(gs.answers)
      patchActive((s) => ({
        ...s,
        guidedSurvey: {
          ...gs,
          active: true,
          awaitingSubmitConfirm: true,
        },
        messages: [
          ...s.messages,
          surveyMsg('assistant', buildSubmitConfirmPrompt(summary)),
        ],
      }))
      return
    }

    const step = Math.min(gs.stepIndex, GUIDED_TOTAL - 1)
    patchActive((s) => ({
      ...s,
      guidedSurvey: { ...gs, active: true, stepIndex: step, awaitingSubmitConfirm: false },
      messages: [
        ...s.messages,
        surveyMsg(
          'assistant',
          formatQuestion(GUIDED_QUESTIONS[step], step, GUIDED_TOTAL),
        ),
      ],
    }))
  }, [activeSessionId, activeSession?.guidedSurvey, patchActive])

  const submitGuidedSurveyAnswer = useCallback(
    (raw: string) => {
      if (!activeSessionId || !activeSession?.guidedSurvey?.active) return

      const text = raw.trim()
      if (!text) return

      const gs = activeSession.guidedSurvey

      if (gs.awaitingSubmitConfirm) {
        const choice = normalizeYesNo(text)
        if (!choice) {
          patchActive((s) => ({
            ...s,
            messages: [
              ...s.messages,
              surveyMsg('user', text),
              surveyMsg('assistant', 'Please reply Yes to submit the form, or No to skip.'),
            ],
          }))
          return
        }

        if (choice === 'No') {
          patchActive((s) => ({
            ...s,
            guidedSurvey: {
              ...s.guidedSurvey!,
              active: false,
              awaitingSubmitConfirm: false,
            },
            messages: [
              ...s.messages,
              surveyMsg('user', text),
              surveyMsg(
                'assistant',
                'No problem — your answers stay saved in this chat. Scroll up to review anytime, or press Continue survey if you want to submit later.',
              ),
            ],
          }))
          return
        }

        patchActive((s) => ({
          ...s,
          guidedSurvey: {
            ...s.guidedSurvey!,
            active: false,
            submitted: true,
            awaitingSubmitConfirm: false,
          },
          messages: [
            ...s.messages,
            surveyMsg('user', text),
            surveyMsg('assistant', 'Form submitted.'),
          ],
        }))
        return
      }

      const stepIndex = gs.stepIndex
      const currentQuestion = GUIDED_QUESTIONS[stepIndex]
      if (!currentQuestion) return

      const answers = { ...gs.answers }

      let accepted: string | null = text
      if (currentQuestion.type === 'yesno') {
        accepted = normalizeYesNo(text)
        if (!accepted) {
          patchActive((s) => ({
            ...s,
            messages: [
              ...s.messages,
              surveyMsg('user', text),
              surveyMsg('assistant', 'Please answer Yes or No.'),
            ],
          }))
          return
        }
      } else if (currentQuestion.type === 'scale') {
        accepted = normalizeScale(text)
        if (!accepted) {
          patchActive((s) => ({
            ...s,
            messages: [
              ...s.messages,
              surveyMsg('user', text),
              surveyMsg('assistant', 'Please reply with a number from 1 to 5.'),
            ],
          }))
          return
        }
      } else if (currentQuestion.type === 'choice' && currentQuestion.options) {
        accepted = normalizeChoice(text, currentQuestion.options)
        if (!accepted) {
          patchActive((s) => ({
            ...s,
            messages: [
              ...s.messages,
              surveyMsg('user', text),
              surveyMsg(
                'assistant',
                'Please pick one of the listed options (type it as shown).',
              ),
            ],
          }))
          return
        }
      } else if (!currentQuestion.required && text.toLowerCase() === 'skip') {
        accepted = '(skipped)'
      }

      answers[currentQuestion.id] = accepted!
      const nextIndex = stepIndex + 1

      if (nextIndex >= GUIDED_TOTAL) {
        const summary = buildSummary(answers)
        patchActive((s) => ({
          ...s,
          messages: [
            ...s.messages,
            surveyMsg('user', text),
            surveyMsg('assistant', formatAnswerRecord(currentQuestion, accepted!)),
            surveyMsg('assistant', buildSubmitConfirmPrompt(summary)),
          ],
          guidedSurvey: {
            ...s.guidedSurvey!,
            answers,
            active: true,
            stepIndex: GUIDED_TOTAL,
            awaitingSubmitConfirm: true,
          },
        }))
        return
      }

      const nextQ = GUIDED_QUESTIONS[nextIndex]
      patchActive((s) => ({
        ...s,
        messages: [
          ...s.messages,
          surveyMsg('user', text),
          surveyMsg('assistant', formatAnswerRecord(currentQuestion, accepted!)),
          surveyMsg('assistant', formatQuestion(nextQ, nextIndex, GUIDED_TOTAL)),
        ],
        guidedSurvey: {
          ...s.guidedSurvey!,
          answers,
          stepIndex: nextIndex,
        },
      }))
    },
    [activeSession, activeSessionId, patchActive],
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
      openPreviewUrl,
      updateFieldValue,
      goToStep,
      undoLastChange,
      syncWithBackend,
      setSandboxPaused: (paused: boolean) =>
        patchActive((s) => ({ ...s, sandbox: { ...s.sandbox, paused } })),
      setSandboxMinimized: (minimized: boolean) =>
        patchActive((s) => ({ ...s, sandbox: { ...s.sandbox, minimized } })),
      refreshSandbox: () => {
        const url = activeSession?.sandbox.url
        if (activeSessionId && activeSession?.sandbox.showPreview && url) {
          void openPreviewUrl(url)
          return
        }
        if (activeSessionId) {
          void postSandboxEvent(
            { type: 'scroll', payload: { refresh: true } },
            activeSessionId,
          )
        }
      },
      confirmSubmit,
      isCreatingSession,
      guidedSurveyActive,
      guidedSurveyAwaitingSubmit,
      guidedSurveySubmitted,
      guidedSurveyStep,
      guidedSurveyTotal: GUIDED_TOTAL,
      startGuidedSurvey,
      submitGuidedSurveyAnswer,
      exitGuidedSurvey,
      resumeGuidedSurvey,
    }),
    [
      sessions,
      activeSessionId,
      userSessionId,
      apiStatus,
      activeSession,
      isAgentBusy,
      isCreatingSession,
      activeFieldId,
      createSession,
      selectSession,
      deleteSession,
      renameSession,
      sendMessage,
      openPreviewUrl,
      updateFieldValue,
      goToStep,
      undoLastChange,
      syncWithBackend,
      patchActive,
      loadChatFromBackend,
      confirmSubmit,
      guidedSurveyActive,
      guidedSurveyAwaitingSubmit,
      guidedSurveySubmitted,
      guidedSurveyStep,
      startGuidedSurvey,
      submitGuidedSurveyAnswer,
      exitGuidedSurvey,
      resumeGuidedSurvey,
    ],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
