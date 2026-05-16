import { useSession } from '../../context/SessionContext'
import styles from './SafetyConfirmation.module.css'

export function SafetyConfirmation() {
  const { confirmSubmit } = useSession()

  return (
    <section className={styles.safety} aria-labelledby="safety-heading">
      <h3 id="safety-heading">Ready to submit?</h3>
      <p>Review everything before sending to the real website.</p>
      <div className={styles.actions} role="group" aria-label="Submit confirmation">
        <button type="button" className={styles.secondary}>
          Review form
        </button>
        <button type="button" className={styles.primary} onClick={confirmSubmit}>
          Submit
        </button>
        <button type="button" className={styles.secondary}>
          Cancel
        </button>
      </div>
    </section>
  )
}
