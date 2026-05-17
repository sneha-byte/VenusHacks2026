import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccessibility } from '../context/AccessibilityContext'
import { useSession } from '../context/SessionContext'
import { SessionSidebar } from '../components/layout/SessionSidebar'
import { SidebarResizeHandle } from '../components/layout/SidebarResizeHandle'
import { AccessibilityToolbar } from '../components/accessibility/AccessibilityToolbar'
import { ChatPanel } from '../components/chat/ChatPanel'
import { SimplifiedFormView } from '../components/simplified/SimplifiedFormView'
import { useSidebarResize } from '../hooks/useSidebarResize'
import styles from './ChatPage.module.css'

export function ChatPage() {
  const navigate = useNavigate()
  const { setOnboardingComplete } = useAccessibility()
  const {
    activeSessionId,
    sessions,
    createSession,
    renameSession,
    simplifiedUi,
  } = useSession()
  const { width: sidebarWidth, onResizeStart: onSidebarResizeStart } = useSidebarResize()
  const [editingHeaderTitle, setEditingHeaderTitle] = useState(false)
  const [headerDraft, setHeaderDraft] = useState('')
  const headerInputRef = useRef<HTMLInputElement>(null)

  const activeSession = sessions.find((s) => s.id === activeSessionId)

  useEffect(() => {
    if (editingHeaderTitle) {
      headerInputRef.current?.focus()
      headerInputRef.current?.select()
    }
  }, [editingHeaderTitle])

  const handleBack = () => {
    setOnboardingComplete(false)
    navigate('/')
  }

  const handleNewChat = () => {
    void createSession().catch(() => undefined)
  }

  const startHeaderRename = () => {
    if (!activeSession) return
    setHeaderDraft(activeSession.title)
    setEditingHeaderTitle(true)
  }

  const saveHeaderRename = () => {
    if (!activeSessionId) return
    renameSession(activeSessionId, headerDraft)
    setEditingHeaderTitle(false)
  }

  return (
    <div className={styles.shell}>
      <SessionSidebar width={sidebarWidth} onNewChat={handleNewChat} />
      <SidebarResizeHandle onMouseDown={onSidebarResizeStart} />

      <div className={styles.main}>
        <header className={styles.topBar}>
          <button type="button" className={styles.backBtn} onClick={handleBack}>
            {'\u2190'} Back
          </button>
          <div className={styles.topBarTitle}>
            {editingHeaderTitle && activeSession ? (
              <div className={styles.headerRename}>
                <input
                  ref={headerInputRef}
                  className={styles.headerInput}
                  value={headerDraft}
                  onChange={(e) => setHeaderDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveHeaderRename()
                    if (e.key === 'Escape') setEditingHeaderTitle(false)
                  }}
                  aria-label="Rename current chat"
                  maxLength={64}
                />
                <button type="button" className={styles.headerSave} onClick={saveHeaderRename}>
                  Save
                </button>
              </div>
            ) : (
              <div className={styles.titleRow}>
                <h1>{activeSession?.title ?? 'Browzen'}</h1>
                {activeSession && (
                  <button
                    type="button"
                    className={`${styles.renameHeaderBtn} optional-chrome`}
                    onClick={startHeaderRename}
                  >
                    Rename chat
                  </button>
                )}
              </div>
            )}
            <p className="optional-chrome">Chat, voice, and simplified UI</p>
          </div>
        </header>

        <AccessibilityToolbar />

        <div className={styles.chatArea}>
          <ChatPanel />

          {simplifiedUi && (
            <div className={styles.agentResults}>
              <SimplifiedFormView />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
