import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { useAccessibility } from '../../context/AccessibilityContext'
import { useSession } from '../../context/SessionContext'
import { useVoiceControl } from '../../hooks/useVoiceControl'
import { isUciPostCourseFormUrl } from '../../data/uciPostCourseForm'
import { extractFirstUrl } from '../../utils/url'
import { MicIcon, StopListeningIcon } from '../icons/VoiceIcons'
import styles from './ChatPanel.module.css'

export function ChatPanel() {
  const { profile, speak } = useAccessibility()
  const {
    messages,
    sendMessage,
    isAgentBusy,
    guidedSurveyActive,
    guidedSurveyExtracting,
    guidedSurveyAwaitingSubmit,
    guidedSurveySubmitted,
    guidedSurveyStep,
    guidedSurveyTotal,
    startGuidedSurvey,
    submitGuidedSurveyAnswer,
    exitGuidedSurvey,
    resumeGuidedSurvey,
    activeSessionId,
  } = useSession()
  const { listening, supported, startListening, stopListening, transcript } =
    useVoiceControl()
  const [input, setInput] = useState('')
  const messagesListRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const lastSpokenMessageIdRef = useRef<string | null>(null)
  const prevReadAloudRef = useRef(profile.readAloud)

  const busy = isAgentBusy
  const hasSavedSurvey =
    !guidedSurveyActive &&
    !guidedSurveySubmitted &&
    messages.some((m) => m.content.includes('Question 1 of'))

  useEffect(() => {
    const el = messagesListRef.current
    if (!el || !stickToBottomRef.current) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [messages.length, messages])

  useEffect(() => {
    const enabled = profile.readAloud || profile.voiceOnly
    const wasEnabled = prevReadAloudRef.current
    if (enabled && !wasEnabled) {
      lastSpokenMessageIdRef.current = null
    }
    prevReadAloudRef.current = enabled
  }, [profile.readAloud, profile.voiceOnly])

  useEffect(() => {
    if (!profile.readAloud && !profile.voiceOnly) return
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    if (!lastAssistant || lastAssistant.id === lastSpokenMessageIdRef.current) return
    lastSpokenMessageIdRef.current = lastAssistant.id
    speak(lastAssistant.content)
  }, [messages, profile.readAloud, profile.voiceOnly, speak])

  const onMessagesScroll = () => {
    const el = messagesListRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    stickToBottomRef.current = nearBottom
  }

  const tryStartGuided = async (text: string) => {
    const url = extractFirstUrl(text)
    if (url && isUciPostCourseFormUrl(url)) {
      await startGuidedSurvey(url)
      return true
    }
    if (/^(start|begin)\s+(form|survey)/i.test(text.trim())) {
      await startGuidedSurvey()
      return true
    }
    return false
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || busy) return
    const text = input
    setInput('')
    stickToBottomRef.current = true

    if (guidedSurveyActive && !guidedSurveyExtracting) {
      submitGuidedSurveyAnswer(text)
      return
    }
    if (guidedSurveyExtracting) return

    if (await tryStartGuided(text)) return

    await sendMessage(text)
  }

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text')
    const url = extractFirstUrl(pasted)
    if (url && isUciPostCourseFormUrl(url)) {
      e.preventDefault()
      setInput('')
      stickToBottomRef.current = true
      void startGuidedSurvey(url)
    }
  }

  const placeholder = guidedSurveyExtracting
    ? 'Extracting information from the document…'
    : guidedSurveyActive
      ? guidedSurveyAwaitingSubmit
        ? 'Reply Yes to submit, or No to keep answers in chat…'
        : guidedSurveyStep < guidedSurveyTotal
          ? 'Type your answer and press Send…'
          : 'Survey complete'
      : 'Paste the UCI form link or type "start form"…'

  return (
    <section
      className={`${styles.panel} ${profile.dyslexiaFont ? styles.dyslexiaChat : ''}`}
      aria-label="Chat"
    >
      {guidedSurveyActive && (
        <div className={styles.guidedBar} role="status">
          <span>
            {guidedSurveyExtracting
              ? 'Reading your document…'
              : guidedSurveyAwaitingSubmit
                ? 'All questions answered — ready to submit'
                : `Step-by-step survey · Question ${Math.min(guidedSurveyStep + 1, guidedSurveyTotal)} of ${guidedSurveyTotal}`}
          </span>
          <button type="button" className={styles.cancelGuided} onClick={exitGuidedSurvey}>
            Exit survey
          </button>
        </div>
      )}

      {!guidedSurveyActive && hasSavedSurvey && activeSessionId && (
        <div className={styles.guidedBar}>
          <span>Saved survey in this chat</span>
          <button type="button" className={styles.cancelGuided} onClick={resumeGuidedSurvey}>
            Continue survey
          </button>
        </div>
      )}

      <div
        ref={messagesListRef}
        className={styles.messages}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        onScroll={onMessagesScroll}
      >
        {messages.length === 0 ? (
          <p className={`${styles.hint} optional-chrome`}>
            Paste your UCI post-course form link here, or type &quot;start form&quot;, and I will
            ask each question one at a time. Scroll up later to see every question and your
            answers.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={m.role === 'user' ? styles.userBubble : styles.assistantBubble}
            >
              <span className="sr-only">{m.role === 'user' ? 'You' : 'Assistant'}:</span>
              <span className={styles.messageBody}>{m.content}</span>
            </div>
          ))
        )}
      </div>

      {transcript && (
        <p className={styles.interim} aria-live="polite">
          Hearing: {transcript}
        </p>
      )}

      <form className={styles.inputRow} onSubmit={onSubmit}>
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <div className={styles.inputWrap}>
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={onPaste}
            placeholder={placeholder}
            disabled={busy || guidedSurveySubmitted || guidedSurveyExtracting}
            autoComplete="off"
          />
          {supported && (
            <button
              type="button"
              className={listening ? styles.micActive : styles.mic}
              onClick={listening ? stopListening : startListening}
              aria-label={listening ? 'Stop listening' : 'Start voice input'}
              aria-pressed={listening}
            >
              {listening ? (
                <StopListeningIcon className={styles.voiceIcon} />
              ) : (
                <MicIcon className={styles.voiceIcon} />
              )}
            </button>
          )}
          <button type="submit" className={styles.send} disabled={busy || guidedSurveyExtracting}>
            {guidedSurveyExtracting ? 'Please wait…' : busy ? 'Working…' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  )
}
