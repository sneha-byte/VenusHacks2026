import { useSession } from '../../context/SessionContext'
import { sandboxStreamUrl } from '../../api/backend'
import { useSandboxStream } from '../../hooks/useSandboxStream'
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

  if (!sandbox.showPreview) {
    return (
      <aside className={styles.column} aria-label="Live website preview">
        <div className={styles.previewLayout}>
          <div className={styles.previewMain}>
            <div className={styles.empty}>
              <p className={styles.emptyMessage}>Doc preview will appear here</p>
              <p className={styles.emptyHint}>Paste a form link in chat to open it here.</p>
            </div>
          </div>
        </div>
      </aside>
    )
  }

  const pages = sandbox.pages ?? []
  const hasPages = pages.length > 0
  const activePage =
    pages.find((p) => p.isActive) ??
    pages.find((p) => p.id === sandbox.activePageId)
  const previewUrl = activePage?.url ?? sandbox.url

  const streamBase =
    sandbox.streamUrl ??
    (activeSessionId ? sandboxStreamUrl(activeSessionId) : undefined)

  const { blobUrl, streamError, loading } = useSandboxStream(streamBase, sandbox.paused)

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
          <header className={styles.header}>
            <div className={styles.headerText}>
              <h2>{sandbox.contextLabel ?? 'Form preview'}</h2>
              {previewUrl && (
                <p className={`${styles.url} optional-chrome`} title={previewUrl}>
                  {previewUrl}
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
            {blobUrl ? (
              <img
                src={blobUrl}
                alt={activePage?.title ? `Form preview — ${activePage.title}` : 'Form preview'}
                className={styles.streamFrame}
              />
            ) : (
              <div className={styles.embedFallback}>
                <p>
                  {loading
                    ? 'Loading form in the preview…'
                    : streamError ?? 'Starting live preview…'}
                </p>
              </div>
            )}
            {sandbox.paused && blobUrl && (
              <div className={styles.pausedOverlay} aria-live="polite">
                Preview paused
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
        </div>
      </div>
    </aside>
  )
}
