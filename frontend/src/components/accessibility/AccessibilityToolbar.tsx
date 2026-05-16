import { useAccessibility } from '../../context/AccessibilityContext'
import styles from './AccessibilityToolbar.module.css'

const OPTIONS = [
  { key: 'largeText' as const, label: 'Large Text', essential: true },
  { key: 'highContrast' as const, label: 'High Contrast', essential: true },
  { key: 'dyslexiaFont' as const, label: 'Dyslexia Font', essential: true },
  { key: 'stepByStep' as const, label: 'Step-by-Step', essential: false },
  { key: 'reduceClutter' as const, label: 'Reduce Clutter', essential: true },
  { key: 'readAloud' as const, label: 'Read Aloud', essential: false },
]

export function AccessibilityToolbar() {
  const { profile, toggleOption } = useAccessibility()

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Accessibility options">
      {OPTIONS.map(({ key, label, essential }) => {
        const active = profile[key]
        return (
          <button
            key={key}
            type="button"
            className={`${active ? styles.chipActive : styles.chip}${essential ? '' : ' optional-chrome'}`}
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
