import { useAccessibility } from '../../context/AccessibilityContext'
import styles from './AccessibilityToolbar.module.css'

const OPTIONS = [
  { key: 'largeText' as const, label: 'Large Text' },
  { key: 'highContrast' as const, label: 'High Contrast' },
  { key: 'dyslexiaFont' as const, label: 'Dyslexia Font' },
  { key: 'stepByStep' as const, label: 'Step-by-Step' },
  { key: 'reduceClutter' as const, label: 'Reduce Clutter' },
  { key: 'readAloud' as const, label: 'Read Aloud' },
]

export function AccessibilityToolbar() {
  const { profile, toggleOption } = useAccessibility()

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Accessibility options">
      {OPTIONS.map(({ key, label }) => {
        const active = profile[key]
        return (
          <button
            key={key}
            type="button"
            className={active ? styles.chipActive : styles.chip}
            aria-pressed={active}
            onClick={() => toggleOption(key)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
