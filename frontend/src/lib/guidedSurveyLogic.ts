import type { ChatMessage } from '../types'
import {
  UCI_FORM_INTRO,
  UCI_FORM_QUESTIONS,
  UCI_FORM_TITLE,
  type GuidedQuestion,
} from '../data/uciPostCourseForm'

export function surveyMsg(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: crypto.randomUUID(), role, content, timestamp: Date.now() }
}

export function formatQuestion(q: GuidedQuestion, index: number, total: number): string {
  const lines = [`Question ${index + 1} of ${total}`, '', q.prompt]
  if (q.hint) lines.push('', q.hint)
  if (q.options?.length) {
    lines.push('', 'Choices:', ...q.options.map((o) => `• ${o}`))
  }
  if (q.type === 'scale') lines.push('', 'Reply with a number from 1 to 5.')
  if (q.type === 'yesno') lines.push('', 'Reply with Yes or No.')
  return lines.join('\n')
}

export function formatAnswerRecord(q: GuidedQuestion, answer: string): string {
  return `Saved — ${answer}\n\n(Question: ${q.prompt})`
}

export function normalizeYesNo(text: string): string | null {
  const t = text.trim().toLowerCase()
  if (['yes', 'y'].includes(t)) return 'Yes'
  if (['no', 'n'].includes(t)) return 'No'
  return null
}

export function normalizeScale(text: string): string | null {
  const m = text.trim().match(/^[1-5]$/)
  return m ? m[0] : null
}

export function normalizeChoice(text: string, options: string[]): string | null {
  const t = text.trim().toLowerCase()
  const exact = options.find((o) => o.toLowerCase() === t)
  if (exact) return exact
  return (
    options.find((o) => o.toLowerCase().includes(t) || t.includes(o.toLowerCase())) ?? null
  )
}

export function buildSummary(answers: Record<string, string>): string {
  return UCI_FORM_QUESTIONS.map((q) => {
    const a = answers[q.id] ?? '—'
    return `Q: ${q.prompt}\nA: ${a}`
  }).join('\n\n')
}

export const GUIDED_TOTAL = UCI_FORM_QUESTIONS.length
export const GUIDED_QUESTIONS = UCI_FORM_QUESTIONS

/** Shown immediately after the user pastes a form link. */
export const GUIDED_EXTRACT_DELAY_MS = 5000

const EXTRACTING_BODY =
  'Extracting information from the document…\n\nPlease wait a moment while I prepare your questions.'

export function extractingPhaseMessages(): ChatMessage[] {
  return [surveyMsg('assistant', UCI_FORM_TITLE), surveyMsg('assistant', EXTRACTING_BODY)]
}

/** Full text read aloud before Question 1 appears. */
export function extractingSpeechTexts(): string[] {
  return [UCI_FORM_TITLE, EXTRACTING_BODY]
}

export function firstQuestionOnlyMessages(): ChatMessage[] {
  const first = UCI_FORM_QUESTIONS[0]
  return [surveyMsg('assistant', formatQuestion(first, 0, GUIDED_TOTAL))]
}

export function introQuestionMessages(): ChatMessage[] {
  const first = UCI_FORM_QUESTIONS[0]
  return [
    surveyMsg('assistant', UCI_FORM_INTRO),
    surveyMsg('assistant', formatQuestion(first, 0, GUIDED_TOTAL)),
  ]
}

/** @deprecated Use extractingPhaseMessages + introQuestionMessages */
export function introMessages(): ChatMessage[] {
  return [...extractingPhaseMessages(), ...introQuestionMessages()]
}

export function buildSubmitConfirmPrompt(summary: string): string {
  return [
    `Thank you! All ${GUIDED_TOTAL} questions are complete.`,
    '',
    summary,
    '',
    'Your answers are saved in this chat — scroll up anytime to review.',
    '',
    'Do you want to submit the form?',
    'Reply Yes to submit, or No to keep your answers here without submitting.',
  ].join('\n')
}
