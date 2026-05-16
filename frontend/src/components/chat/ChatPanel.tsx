import { useState, type FormEvent } from 'react'
import { useSession } from '../../context/SessionContext'
import { useVoiceControl } from '../../hooks/useVoiceControl'
import { MicIcon, StopListeningIcon } from '../icons/VoiceIcons'
import styles from './ChatPanel.module.css'

export function ChatPanel() {
  const { messages, sendMessage, isAgentBusy, activeSessionId } = useSession()
  const { listening, supported, startListening, stopListening, transcript } =
    useVoiceControl()
  const [input, setInput] = useState('')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isAgentBusy || !activeSessionId) return
    const text = input
    setInput('')
    await sendMessage(text)
  }

  return (
    <section className={styles.panel} aria-label="Chat">
      <div
        className={styles.messages}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 ? (
          <p className={`${styles.hint} optional-chrome`}>
            Describe what you need — for example, which website or form you want help with.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={msg.role === 'user' ? styles.userBubble : styles.assistantBubble}
            >
              <span className="sr-only">{msg.role === 'user' ? 'You' : 'Assistant'}:</span>
              {msg.content}
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
            placeholder="Type your request here…"
            disabled={isAgentBusy || !activeSessionId}
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
          <button
            type="submit"
            className={styles.send}
            disabled={isAgentBusy || !activeSessionId}
          >
            {isAgentBusy ? 'Working…' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  )
}
