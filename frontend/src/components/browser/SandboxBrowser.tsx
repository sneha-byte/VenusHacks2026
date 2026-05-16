import { useSession } from '../../context/SessionContext'
import { useSandboxBrowser } from '../../hooks/useSandboxBrowser'
import { ActionLog } from './ActionLog'
import { SafetyConfirmation } from './SafetyConfirmation'
import styles from './SandboxBrowser.module.css'

export function SandboxBrowser() {
  const {
    sandbox,
    actionLog,
    simplifiedUi,
    setSandboxPaused,
    setSandboxMinimized,
    refreshSandbox,
    activeSessionId,
  } = useSession()
  const { frameRef } = useSandboxBrowser(activeSessionId ?? undefined)

  const hasPreview = Boolean(sandbox.url || sandbox.streamUrl)
  if (!hasPreview) return null

  if (sandbox.minimized) {
    return (
      <aside className={styles.minimized}>
        <p>Website preview minimized</p>
        <button type="button" onClick={() => setSandboxMinimized(false)}>
          Show preview
        </button>
      </aside>
    )
  }

  return (
    <aside className={styles.panel} aria-labelledby="sandbox-heading">
      <header className={styles.header}>
        <h2 id="sandbox-heading">Website preview</h2>
        <p className={styles.subtitle}>Live view from the agent</p>
      </header>

      <div className={styles.controls} role="toolbar" aria-label="Preview controls">
        <button type="button" onClick={() => setSandboxMinimized(true)}>
          Minimize
        </button>
        <button
          type="button"
          onClick={() => setSandboxPaused(!sandbox.paused)}
          aria-pressed={sandbox.paused}
        >
          {sandbox.paused ? 'Resume agent' : 'Pause agent'}
        </button>
        <button type="button" onClick={refreshSandbox}>
          Refresh
        </button>
      </div>

      {(sandbox.contextLabel || sandbox.url) && (
        <div className={styles.meta}>
          {sandbox.contextLabel && (
            <p className={styles.context}>{sandbox.contextLabel}</p>
          )}
          {sandbox.url && (
            <p className={styles.url}>
              URL: <span>{sandbox.url}</span>
            </p>
          )}
        </div>
      )}

      <div className={styles.viewport}>
        {sandbox.streamUrl ? (
          <iframe
            ref={frameRef}
            title="Sandboxed website preview"
            src={sandbox.streamUrl}
            className={styles.frame}
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        ) : sandbox.url ? (
          <iframe
            ref={frameRef}
            title="Sandboxed website preview"
            src={sandbox.url}
            className={styles.frame}
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        ) : null}
        {sandbox.paused && (
          <div className={styles.pausedOverlay} aria-live="polite">
            Agent paused
          </div>
        )}
      </div>

      {actionLog.length > 0 && <ActionLog />}
      {simplifiedUi && <SafetyConfirmation />}
    </aside>
  )
}
