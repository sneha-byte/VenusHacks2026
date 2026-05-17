import { useEffect, useRef, useState } from 'react'
import { useSession } from '../../context/SessionContext'
import type { ChatSession } from '../../types'
import { BrowzenLogo } from '../brand/BrowzenLogo'
import { PenIcon, TrashIcon } from './SessionIcons'
import styles from './SessionSidebar.module.css'

type Props = {
  width: number
  onNewChat: () => void
}

export function SessionSidebar({ width, onNewChat }: Props) {
  const {
    sessions,
    activeSessionId,
    selectSession,
    deleteSession,
    renameSession,
    isCreatingSession,
  } = useSession()
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleDelete = (id: string, title: string) => {
    const label = title || 'this chat'
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return
    void deleteSession(id)
    if (editingId === id) setEditingId(null)
  }

  return (
    <aside
      className={styles.sidebar}
      style={{ width, minWidth: width, maxWidth: width }}
      aria-label="Chat sessions"
    >
      <div className={styles.brand}>
        <BrowzenLogo size={36} showWordmark variant="light" />
      </div>

      <button
        type="button"
        className={styles.newChat}
        disabled={isCreatingSession}
        onClick={() => {
          onNewChat()
        }}
      >
        {isCreatingSession ? 'Creating…' : '+ New chat'}
      </button>

      <nav className={styles.list} aria-label="Past sessions">
        {sessions.length === 0 ? (
          <p className={styles.empty}>No past sessions yet</p>
        ) : (
          <ul>
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                isEditing={editingId === session.id}
                onSelect={() => selectSession(session.id)}
                onStartRename={() => setEditingId(session.id)}
                onCancelRename={() => setEditingId(null)}
                onSaveRename={(title) => {
                  renameSession(session.id, title)
                  setEditingId(null)
                }}
                onDelete={() => handleDelete(session.id, session.title)}
              />
            ))}
          </ul>
        )}
      </nav>
    </aside>
  )
}

type RowProps = {
  session: ChatSession
  isActive: boolean
  isEditing: boolean
  onSelect: () => void
  onStartRename: () => void
  onCancelRename: () => void
  onSaveRename: (title: string) => void
  onDelete: () => void
}

function SessionRow({
  session,
  isActive,
  isEditing,
  onSelect,
  onStartRename,
  onCancelRename,
  onSaveRename,
  onDelete,
}: RowProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(session.title)

  useEffect(() => {
    if (isEditing) {
      setDraft(session.title)
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing, session.title])

  const save = () => onSaveRename(draft)

  return (
    <li className={isActive ? styles.rowActive : styles.row}>
      {isEditing ? (
        <div className={styles.editBlock}>
          <input
            ref={inputRef}
            className={styles.renameInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') onCancelRename()
            }}
            aria-label="Chat name"
            maxLength={64}
          />
          <div className={styles.editActions}>
            <button type="button" className={styles.saveBtn} onClick={save}>
              Save
            </button>
            <button type="button" className={styles.cancelBtn} onClick={onCancelRename}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.rowInner}>
          <button
            type="button"
            className={styles.item}
            onClick={onSelect}
            onDoubleClick={onStartRename}
            aria-current={isActive ? 'true' : undefined}
            title="Double-click to rename"
          >
            <span className={styles.itemTitle}>{session.title}</span>
            <time
              className={`${styles.itemDate} optional-chrome`}
              dateTime={new Date(session.updatedAt).toISOString()}
            >
              {formatSessionDate(session.updatedAt)}
            </time>
          </button>
          <div className={styles.rowActions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onStartRename}
              aria-label={`Rename ${session.title}`}
              title="Rename"
            >
              <PenIcon />
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
              onClick={onDelete}
              aria-label={`Delete ${session.title}`}
              title="Delete"
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      )}
    </li>
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
