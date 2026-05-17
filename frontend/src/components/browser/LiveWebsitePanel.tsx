import { useEffect, useState } from 'react'
import { useSession } from '../../context/SessionContext'
import { getSandboxStreamUrl } from '../../api/client'
import { ActionLog } from './ActionLog'
import { SafetyConfirmation } from './SafetyConfirmation'
import styles from './LiveWebsitePanel.module.css'

const TAB_COLORS = [
  'var(--color-blush-rose)',
  'var(--color-ivory)',
  'var(--color-dry-sage)',
  'var(--color-jet-black)',
]

export function LiveWebsitePanel() {
  const {
    sandbox,
    actionLog,
    simplifiedUi,
    setSandboxPaused,
    refreshSandbox,
    activeSessionId,
  } = useSession()

  const [streamTick, setStreamTick] = useState(0)
  const pages = sandbox.pages ?? []
  const hasPages = pages.length > 0
  const hasPreview = Boolean(hasPages || sandbox.url || sandbox.streamUrl)
  const activePage =
    pages.find((p) => p.isActive) ??
    pages.find((p) => p.id === sandbox.activePageId)
  const streamBase =
    sandbox.streamUrl ??
    (activeSessionId && hasPages ? getSandboxStreamUrl(activeSessionId) : undefined)
  const streamSrc = streamBase
    ? `${streamBase}${streamBase.includes('?') ? '&' : '?'}t=${streamTick}`
    : undefined
  const frameSrc = !streamSrc ? sandbox.url : undefined

  useEffect(() => {
    if (!streamBase || sandbox.paused) return
    const interval = window.setInterval(() => {
      setStreamTick((t) => t + 1)
    }, 2000)
    return () => window.clearInterval(interval)
  }, [streamBase, sandbox.paused])

  return (
    <aside className={styles.column} aria-label="Live website preview">
      <div className={styles.previewLayout}>
        {hasPages && (
          <nav className={styles.pageTabs} aria-label="Open pages">
            {pages.map((page, index) => (
              <button
                key={page.id}
                type="button"
                className={`${styles.pageTab} ${page.isActive ? styles.pageTabActive : ''}`}
                style={{
                  background: TAB_COLORS[index % TAB_COLORS.length],
                  color:
                    index % TAB_COLORS.length === 3
                      ? 'var(--color-ivory)'
                      : 'var(--color-jet-black)',
                }}
                title={page.url}
                aria-current={page.isActive ? 'true' : undefined}
                disabled
              >
                <span className={styles.pageTabLabel}>
                  {page.title.slice(0, 1).toUpperCase() || String(index + 1)}
                </span>
              </button>
            ))}
          </nav>
        )}

        <div className={styles.previewMain}>
          {hasPreview ? (
            <>
              <header className={styles.header}>
                <div className={styles.headerText}>
                  <h2>Live website</h2>
                  {(activePage?.title || sandbox.contextLabel) && (
                    <p className={`${styles.context} optional-chrome`}>
                      {activePage?.title ?? sandbox.contextLabel}
                    </p>
                  )}
                  {(activePage?.url || sandbox.url) && (
                    <p
                      className={`${styles.url} optional-chrome`}
                      title={activePage?.url ?? sandbox.url}
                    >
                      {activePage?.url ?? sandbox.url}
                    </p>
                  )}
                </div>
                <div
                  className={`${styles.controls} optional-chrome`}
                  role="toolbar"
                  aria-label="Preview controls"
                >
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
                {streamSrc ? (
                  <img
                    src={streamSrc}
                    alt={
                      activePage?.title
                        ? `Live stream — ${activePage.title}`
                        : 'Live browser stream'
                    }
                    className={styles.streamFrame}
                  />
                ) : frameSrc ? (
                  <iframe
                    title="Live website — form filling preview"
                    src={frameSrc}
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
            <div className={styles.empty}>
              <p className={styles.emptyMessage}>Doc preview will appear here</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
