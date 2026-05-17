import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccessibility } from '../context/AccessibilityContext'
import { useSession } from '../context/SessionContext'

type SpeechRecognitionCtor = new () => SpeechRecognition

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useVoiceControl() {
  const { speak } = useAccessibility()
  const session = useSession()
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const handleCommand = useCallback(
    (raw: string) => {
      const text = raw.toLowerCase().trim()
      setTranscript(text)

      if (text.includes('go next') || text.includes('next')) {
        session.goToStep('next')
        speak('Moving to the next step.')
        return
      }
      if (text.includes('go back') || text.includes('back')) {
        session.goToStep('back')
        speak('Going back.')
        return
      }
      if (text.includes('read') || text.includes('read aloud')) {
        const lastAssistant = [...session.messages]
          .reverse()
          .find((m) => m.role === 'assistant')
        if (lastAssistant) {
          speak(lastAssistant.content)
          return
        }
        const field = session.simplifiedUi?.fields.find(
          (f) => f.id === session.activeFieldId,
        )
        if (field) speak(`${field.label}. ${field.value || field.placeholder || 'empty'}`)
        return
      }
      if (text.includes('bigger') || text.includes('large text')) {
        speak('Turn on large text in the accessibility bar, or say it again after we add voice settings.')
        return
      }
      if (text.includes('explain')) {
        session.sendMessage('Explain the current question on this form')
        return
      }
      if (text.includes('stop')) {
        window.speechSynthesis.cancel()
        recognitionRef.current?.stop()
        setListening(false)
        return
      }
      if (text.includes('undo')) {
        session.undoLastChange()
        speak('Undid the last change.')
        return
      }
      if (text.includes('autofill')) {
        session.sendMessage('Autofill this form with my saved information')
        return
      }
      if (text.includes('submit')) {
        session.confirmSubmit()
        speak('Ready to submit. Please review and confirm.')
        return
      }

      if (text.length > 2) session.sendMessage(raw)
    },
    [session, speak],
  )

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) return

    const recognition = new Ctor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1]
      const said = result[0]?.transcript ?? ''
      if (result.isFinal) handleCommand(said)
      else setTranscript(said)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [handleCommand])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()))
    return () => recognitionRef.current?.abort()
  }, [])

  return {
    listening,
    transcript,
    supported,
    startListening,
    stopListening,
  }
}
