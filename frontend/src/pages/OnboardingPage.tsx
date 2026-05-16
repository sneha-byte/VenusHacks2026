import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccessibility } from '../context/AccessibilityContext'
import { useSession } from '../context/SessionContext'
import styles from './OnboardingPage.module.css'

const NEED_OPTIONS = [
  { id: 'adhd', label: 'ADHD / easily overwhelmed', desc: 'Reduce clutter and break tasks into steps' },
  { id: 'cognitive', label: 'Cognitive disability', desc: 'Clear labels, confirmations, and guided flow' },
  { id: 'elderly', label: 'Elderly or non-technical', desc: 'Large text, voice help, plain language' },
  { id: 'dyslexia', label: 'Dyslexia', desc: 'OpenDyslexic font and high contrast' },
  { id: 'executive', label: 'Executive dysfunction', desc: 'One step at a time with undo' },
  { id: 'other', label: 'Other', desc: '' },
]

const QUICK_TOGGLES = [
  { key: 'largeText' as const, label: 'Large text' },
  { key: 'highContrast' as const, label: 'High contrast' },
  { key: 'dyslexiaFont' as const, label: 'Dyslexia-friendly font' },
  { key: 'stepByStep' as const, label: 'Step-by-step mode' },
  { key: 'readAloud' as const, label: 'Read aloud' },
  { key: 'voiceOnly' as const, label: 'Prefer voice control' },
]

export function OnboardingPage() {
  const navigate = useNavigate()
  const { profile, setNeeds, toggleOption, setOnboardingComplete, updateProfile } =
    useAccessibility()
  const { createSession } = useSession()
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>(profile.needs)

  const toggleNeed = (id: string) => {
    setSelectedNeeds((prev) => {
      const next = prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
      setNeeds(next)
      if (id === 'dyslexia' && !prev.includes(id)) updateProfile({ dyslexiaFont: true })
      if (id === 'adhd' && !prev.includes(id)) updateProfile({ reduceClutter: true, stepByStep: true })
      if (id === 'elderly' && !prev.includes(id)) updateProfile({ largeText: true, readAloud: true })
      return next
    })
  }

  const finish = () => {
    createSession()
    setOnboardingComplete(true)
    navigate('/app')
  }

  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <header className={styles.hero}>
          <h1>Welcome to EasyWeb</h1>
          <p>
            We simplify confusing websites so you can complete forms and tasks with less stress.
            Choose what helps you most — you can change these anytime.
          </p>
        </header>

        <section aria-labelledby="needs-heading">
          <h2 id="needs-heading">What do you need help with?</h2>
          <ul className={styles.needGrid}>
            {NEED_OPTIONS.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  className={
                    selectedNeeds.includes(opt.id) ? styles.needActive : styles.needCard
                  }
                  aria-pressed={selectedNeeds.includes(opt.id)}
                  onClick={() => toggleNeed(opt.id)}
                >
                  <span className={styles.needLabel}>{opt.label}</span>
                  {opt.desc ? <span className={styles.needDesc}>{opt.desc}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="options-heading">
          <h2 id="options-heading">Accessibility options</h2>
          <div className={styles.toggleRow}>
            {QUICK_TOGGLES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={profile[key] ? styles.chipOn : styles.chip}
                aria-pressed={profile[key]}
                onClick={() =>
                  key === 'voiceOnly'
                    ? updateProfile({ voiceOnly: !profile.voiceOnly })
                    : toggleOption(key)
                }
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <footer className={styles.footer}>
          <button type="button" className={styles.primary} onClick={finish}>
            Start a new session
          </button>
          <button type="button" className={styles.link} onClick={finish}>
            Skip for now
          </button>
        </footer>
      </main>
    </div>
  )
}
