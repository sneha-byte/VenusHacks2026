import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccessibility } from '../context/AccessibilityContext'
import { useSession } from '../context/SessionContext'
import { EasyWebLogo } from '../components/brand/EasyWebLogo'
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

const FEATURES = [
  {
    title: 'Simpler forms',
    desc: 'Confusing pages become clear, step-by-step fields you can actually finish.',
    icon: '📋',
  },
  {
    title: 'Live preview',
    desc: 'Watch the real website fill in while you chat — nothing happens in secret.',
    icon: '👁',
  },
  {
    title: 'Built for you',
    desc: 'Voice, large text, dyslexia font, and calm layouts you control anytime.',
    icon: '♿',
  },
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

  const finish = async () => {
    await createSession()
    setOnboardingComplete(true)
    navigate('/app')
  }

  const scrollToSetup = () => {
    document.getElementById('setup')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className={styles.site}>
      <header className={styles.nav}>
        <EasyWebLogo size={40} showWordmark variant="light" />
        <nav className={styles.navLinks} aria-label="Page sections">
          <button type="button" className={styles.navLink} onClick={scrollToSetup}>
            Personalize
          </button>
          <button type="button" className={styles.navCta} onClick={finish}>
            Get started
          </button>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <EasyWebLogo size={72} />
          <p className={styles.eyebrow}>Accessible web assistant</p>
          <h1 className={styles.heroTitle}>
            Finish forms online
            <span className={styles.heroAccent}> without the stress</span>
          </h1>
          <p className={styles.heroLead}>
            EasyWeb guides you through government, medical, and everyday sites with plain language,
            voice help, and a live preview of what&apos;s being filled.
          </p>
          <div className={styles.heroActions}>
            <button type="button" className={styles.primary} onClick={scrollToSetup}>
              Personalize my experience
            </button>
            <button type="button" className={styles.secondary} onClick={finish}>
              Jump straight in
            </button>
          </div>
        </div>
      </section>

      <section className={styles.features} aria-labelledby="features-heading">
        <h2 id="features-heading" className={styles.sectionTitle}>
          How EasyWeb helps
        </h2>
        <ul className={styles.featureGrid}>
          {FEATURES.map((f) => (
            <li key={f.title} className={styles.featureCard}>
              <span className={styles.featureIcon} aria-hidden="true">
                {f.icon}
              </span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="setup" className={styles.setup} aria-labelledby="setup-heading">
        <div className={styles.setupInner}>
          <header className={styles.setupHeader}>
            <h2 id="setup-heading">Set up your workspace</h2>
            <p>Pick what applies to you. You can change everything later from the app.</p>
          </header>

          <div className={styles.setupGrid}>
            <article className={styles.setupPanel} aria-labelledby="needs-heading">
              <h3 id="needs-heading">What do you need help with?</h3>
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
            </article>

            <article className={styles.setupPanel} aria-labelledby="options-heading">
              <h3 id="options-heading">Accessibility options</h3>
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
            </article>
          </div>

          <footer className={styles.setupFooter}>
            <button type="button" className={styles.primary} onClick={finish}>
              Start a new session
            </button>
            <button type="button" className={styles.link} onClick={finish}>
              Skip for now
            </button>
          </footer>
        </div>
      </section>

      <footer className={styles.siteFooter}>
        <EasyWebLogo size={32} showWordmark />
        <p>© {new Date().getFullYear()} EasyWeb · Built for accessible browsing</p>
      </footer>
    </div>
  )
}
