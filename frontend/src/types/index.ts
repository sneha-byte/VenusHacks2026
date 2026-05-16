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
}

export type ActionLogItem = {
  id: string
  label: string
  status: 'done' | 'pending' | 'waiting'
}

export type SandboxSession = {
  url?: string
  contextLabel?: string
  streamUrl?: string
  paused: boolean
  minimized: boolean
}

export type ChatSession = {
  id: string
  title: string
  messages: ChatMessage[]
  simplifiedUi: SimplifiedUiState | null
  sandbox: SandboxSession
  actionLog: ActionLogItem[]
  updatedAt: number
}

export type BrowserEvent = {
  type: 'click' | 'scroll' | 'input' | 'submit'
  targetId?: string
  payload?: Record<string, unknown>
}
