import { useSession } from '../../context/SessionContext'
import { useSandboxBrowser } from '../../hooks/useSandboxBrowser'
import { ActionLog } from './ActionLog'
import { SafetyConfirmation } from './SafetyConfirmation'
import styles from './LiveWebsitePanel.module.css'

export function LiveWebsitePanel() {
  const {
    sandbox,
    actionLog,
    simplifiedUi,
    setSandboxPaused,
    refreshSandbox,
    activeSessionId,
  } = useSession()
  const { frameRef } = useSandboxBrowser(activeSessionId ?? undefined)

  const hasPreview = Boolean(sandbox.url || sandbox.streamUrl)
  const frameSrc = sandbox.streamUrl ?? sandbox.url

  return (
    <aside className={styles.column} aria-label="Live website preview">
      {hasPreview && frameSrc ? (
        <>
          <header className={styles.header}>
            <div className={styles.headerText}>
              <h2>Live website</h2>
              {sandbox.contextLabel && (
                <p className={`${styles.context} optional-chrome`}>{sandbox.contextLabel}</p>
              )}
              {sandbox.url && (
                <p className={`${styles.url} optional-chrome`} title={sandbox.url}>
                  {sandbox.url}
                </p>
              )}
            </div>
            <div className={`${styles.controls} optional-chrome`} role="toolbar" aria-label="Preview controls">
              <button
                type="button"
                onClick={() => setSandboxPaused(!sandbox.paused)}
                aria-pressed={sandbox.paused}
              >
                {sandbox.paused ? 'Resume' : 'Pause'}
              </button>
              <button type="button" onClick={refreshSandbox}>
                Refresh
              </button>
            </div>
          </header>

          <div className={styles.viewport}>
            <iframe
              ref={frameRef}
              title="Live website — form filling preview"
              src={frameSrc}
              className={styles.frame}
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
            {sandbox.paused && (
              <div className={styles.pausedOverlay} aria-live="polite">
                Agent paused
              </div>
            )}
          </div>

          {actionLog.length > 0 && (
            <div className={`${styles.footer} optional-chrome`}>
              <ActionLog />
            </div>
          )}
          {simplifiedUi && (
            <div className={styles.footer}>
              <SafetyConfirmation />
            </div>
          )}
        </>
      ) : (
        <div className={styles.empty} aria-hidden="true" />
      )}
    </aside>
  )
}
