import styles from './SidebarResizeHandle.module.css'

type Props = {
  onMouseDown: (event: React.MouseEvent) => void
}

export function SidebarResizeHandle({ onMouseDown }: Props) {
  return (
    <div
      className={styles.handle}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      tabIndex={0}
      onMouseDown={onMouseDown}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
        }
      }}
    />
  )
}
