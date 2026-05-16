import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccessibility } from '../context/AccessibilityContext'
import { useSession } from '../context/SessionContext'
import { SessionSidebar } from '../components/layout/SessionSidebar'
import { AccessibilityToolbar } from '../components/accessibility/AccessibilityToolbar'
import { ChatPanel } from '../components/chat/ChatPanel'
import { SimplifiedFormView } from '../components/simplified/SimplifiedFormView'
import { SandboxBrowser } from '../components/browser/SandboxBrowser'
import styles from './ChatPage.module.css'

export function ChatPage() {
  const navigate = useNavigate()
  const { setOnboardingComplete } = useAccessibility()
  const {
    activeSessionId,
    sessions,
    createSession,
    simplifiedUi,
    sandbox,
  } = useSession()

  useEffect(() => {
    if (!activeSessionId && sessions.length === 0) {
      createSession()
    }
  }, [activeSessionId, sessions.length, createSession])

  const handleBack = () => {
    setOnboardingComplete(false)
    navigate('/')
  }

  const handleNewChat = () => {
    createSession()
  }

  const hasSandbox = Boolean(sandbox.url || sandbox.streamUrl)

  return (
    <div className={styles.shell}>
      <SessionSidebar onNewChat={handleNewChat} />

      <div className={styles.main}>
        <header className={styles.topBar}>
          <button type="button" className={styles.backBtn} onClick={handleBack}>
            ← Back
          </button>
          <div className={styles.topBarTitle}>
            <h1>EasyWeb Assistant</h1>
            <p>Chat · Voice · Simplified UI</p>
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

          {hasSandbox && (
            <div className={styles.agentResults}>
              <SandboxBrowser />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
