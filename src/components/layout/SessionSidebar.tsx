import { useSession } from '../../context/SessionContext'
import styles from './SessionSidebar.module.css'

type Props = {
  onNewChat: () => void
}

export function SessionSidebar({ onNewChat }: Props) {
  const { sessions, activeSessionId, selectSession } = useSession()

  return (
    <aside className={styles.sidebar} aria-label="Chat sessions">
      <div className={styles.brand}>
        <span className={styles.logo}>EasyWeb</span>
      </div>

      <button type="button" className={styles.newChat} onClick={onNewChat}>
        + New chat
      </button>

      <nav className={styles.list} aria-label="Past sessions">
        {sessions.length === 0 ? (
          <p className={styles.empty}>No past sessions yet</p>
        ) : (
          <ul>
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  className={
                    session.id === activeSessionId ? styles.itemActive : styles.item
                  }
                  onClick={() => selectSession(session.id)}
                  aria-current={session.id === activeSessionId ? 'true' : undefined}
                >
                  <span className={styles.itemTitle}>{session.title}</span>
                  <time className={styles.itemDate} dateTime={new Date(session.updatedAt).toISOString()}>
                    {formatSessionDate(session.updatedAt)}
                  </time>
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  )
}

function formatSessionDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
