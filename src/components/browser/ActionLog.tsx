import { useSession } from '../../context/SessionContext'
import styles from './ActionLog.module.css'

const ICON = { done: '✓', pending: '…', waiting: '⌛' } as const

export function ActionLog() {
  const { actionLog } = useSession()

  return (
    <section className={styles.log} aria-labelledby="action-log-heading">
      <h3 id="action-log-heading">Action log</h3>
      <ul>
        {actionLog.map((item) => (
          <li key={item.id} className={styles[item.status]}>
            <span aria-hidden="true">{ICON[item.status]}</span>
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  )
}
