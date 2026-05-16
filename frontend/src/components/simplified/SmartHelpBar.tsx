import { useSession } from '../../context/SessionContext'
import { useAccessibility } from '../../context/AccessibilityContext'
import styles from './SmartHelpBar.module.css'

type Props = {
  onNext: () => void
  onBack: () => void
}

export function SmartHelpBar({ onNext, onBack }: Props) {
  const { sendMessage, undoLastChange, confirmSubmit } = useSession()
  const { speak, profile } = useAccessibility()

  const explain = () => sendMessage('Explain the current question on this form')
  const readAloud = () => speak('Reading the current field aloud.')
  const autofill = () => sendMessage('Autofill this form with my saved information')

  return (
    <div>
      <h3 className={styles.title}>Smart Help</h3>
      <div className={styles.actions} role="group" aria-label="Smart help actions">
        <button type="button" className={styles.btn} onClick={explain}>
          Explain this question
        </button>
        <button type="button" className={`${styles.btn} optional-chrome`} onClick={autofill}>
          Autofill
        </button>
        <button
          type="button"
          className={`${styles.btn} optional-chrome`}
          onClick={readAloud}
          disabled={!profile.readAloud}
        >
          Read aloud
        </button>
        <button
          type="button"
          className={`${styles.btn} optional-chrome`}
          onClick={() => sendMessage('Show an example answer')}
        >
          Show example
        </button>
        <button type="button" className={`${styles.btn} optional-chrome`} onClick={undoLastChange}>
          Undo
        </button>
        <button type="button" className={styles.btnPrimary} onClick={onBack}>
          Back
        </button>
        <button type="button" className={styles.btnPrimary} onClick={onNext}>
          Next
        </button>
        <button type="button" className={styles.btnConfirm} onClick={confirmSubmit}>
          Confirm before submit
        </button>
      </div>

      <div className={`${styles.voiceHints} optional-chrome`}>
        <h4>Voice commands</h4>
        <ul>
          <li>“Go next” · “Read this” · “Make text bigger”</li>
          <li>“Explain this” · “Stop” · “Undo”</li>
        </ul>
      </div>
    </div>
  )
}
