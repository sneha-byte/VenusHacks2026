export type AccessibilityProfile = {
  largeText: boolean
  highContrast: boolean
  dyslexiaFont: boolean
  stepByStep: boolean
  reduceClutter: boolean
  readAloud: boolean
  voiceOnly: boolean
  needs: string[]
}

export type ChatRole = 'user' | 'assistant' | 'system'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  timestamp: number
  simplifiedUi?: SimplifiedUiState
}

export type FormFieldType = 'text' | 'date' | 'textarea' | 'select' | 'checkbox'

export type SimplifiedField = {
  id: string
  label: string
  type: FormFieldType
  value: string
  placeholder?: string
  required?: boolean
  helpText?: string
  options?: string[]
}

export type SimplifiedUiState = {
  title: string
  description?: string
  fields: SimplifiedField[]
  currentStep?: number
  totalSteps?: number
  /** Backend form UI block id — required for POST /agent/submit-form */
  formReferenceId?: string
}

export type ActionLogItem = {
  id: string
  label: string
  status: 'done' | 'pending' | 'waiting'
}

export type PreviewPage = {
  id: string
  title: string
  url: string
  isActive: boolean
}

export type SandboxSession = {
  url?: string
  contextLabel?: string
  streamUrl?: string
  pages: PreviewPage[]
  activePageId?: string
  paused: boolean
  minimized: boolean
  /** True only after user pastes/sends a link in chat */
  showPreview: boolean
}

export type GuidedSurveyState = {
  formUrl: string
  answers: Record<string, string>
  active: boolean
  stepIndex: number
  /** All questions answered; waiting for Yes/No to submit */
  awaitingSubmitConfirm?: boolean
  /** User confirmed and form was sent to Google */
  submitted?: boolean
}

export type ChatSession = {
  id: string
  title: string
  messages: ChatMessage[]
  simplifiedUi: SimplifiedUiState | null
  sandbox: SandboxSession
  actionLog: ActionLogItem[]
  guidedSurvey?: GuidedSurveyState | null
  updatedAt: number
}

export type BrowserEvent = {
  type: 'click' | 'scroll' | 'input' | 'submit' | 'navigate'
  targetId?: string
  payload?: Record<string, unknown>
}
