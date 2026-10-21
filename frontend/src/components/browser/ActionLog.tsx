import { useSession } from '../../context/SessionContext'
import type { ActionLogItem } from '../../types'
import styles from './ActionLog.module.css'

const ICON = { done: '✓', pending: '…', waiting: '⌛' } as const

/** Shows live agent steps when `items` is passed, otherwise the session's log. */
export function ActionLog({ items }: { items?: ActionLogItem[] }) {
  const { actionLog: sessionLog } = useSession()
  const actionLog = items ?? sessionLog

  return (
    <section className={styles.log} aria-labelledby="action-log-heading" aria-live="polite">
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
