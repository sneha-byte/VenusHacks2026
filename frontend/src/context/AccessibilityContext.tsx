import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { speakText } from '../lib/speech'
import type { AccessibilityProfile } from '../types'

const STORAGE_KEY = 'clearpath-accessibility'

const defaultProfile: AccessibilityProfile = {
  largeText: false,
  highContrast: false,
  dyslexiaFont: false,
  stepByStep: true,
  reduceClutter: false,
  readAloud: false,
  voiceOnly: false,
  needs: [],
}

function loadProfile(): AccessibilityProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaultProfile, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return defaultProfile
}

type AccessibilityContextValue = {
  profile: AccessibilityProfile
  onboardingComplete: boolean
  setOnboardingComplete: (value: boolean) => void
  updateProfile: (patch: Partial<AccessibilityProfile>) => void
  toggleOption: (key: keyof Omit<AccessibilityProfile, 'needs' | 'voiceOnly'>) => void
  setNeeds: (needs: string[]) => void
  speak: (text: string) => void
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null)

function applyDataAttributes(profile: AccessibilityProfile) {
  const root = document.documentElement
  root.dataset.largeText = String(profile.largeText)
  root.dataset.highContrast = String(profile.highContrast)
  root.dataset.dyslexiaFont = String(profile.dyslexiaFont)
  root.dataset.reduceClutter = String(profile.reduceClutter)
  root.dataset.stepByStep = String(profile.stepByStep)
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AccessibilityProfile>(() => {
    const loaded = loadProfile()
    applyDataAttributes(loaded)
    return loaded
  })
  const [onboardingComplete, setOnboardingComplete] = useState(
    () => localStorage.getItem('clearpath-onboarded') === 'true',
  )

  const persist = useCallback((next: AccessibilityProfile) => {
    setProfile(next)
    applyDataAttributes(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const updateProfile = useCallback(
    (patch: Partial<AccessibilityProfile>) => {
      persist({ ...profile, ...patch })
    },
    [profile, persist],
  )

  const toggleOption = useCallback(
    (key: keyof Omit<AccessibilityProfile, 'needs' | 'voiceOnly'>) => {
      persist({ ...profile, [key]: !profile[key] })
    },
    [profile, persist],
  )

  const setNeeds = useCallback(
    (needs: string[]) => persist({ ...profile, needs }),
    [profile, persist],
  )

  useEffect(() => {
    const loadVoices = () => window.speechSynthesis.getVoices()
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!profile.readAloud && !profile.voiceOnly) return
      speakText(text)
    },
    [profile.readAloud, profile.voiceOnly],
  )

  const completeOnboarding = useCallback((value: boolean) => {
    setOnboardingComplete(value)
    if (value) localStorage.setItem('clearpath-onboarded', 'true')
  }, [])

  const value = useMemo(
    () => ({
      profile,
      onboardingComplete,
      setOnboardingComplete: completeOnboarding,
      updateProfile,
      toggleOption,
      setNeeds,
      speak,
    }),
    [
      profile,
      onboardingComplete,
      completeOnboarding,
      updateProfile,
      toggleOption,
      setNeeds,
      speak,
    ],
  )

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext)
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider')
  return ctx
}
