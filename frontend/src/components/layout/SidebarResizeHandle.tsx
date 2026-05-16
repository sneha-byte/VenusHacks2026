import styles from './SidebarResizeHandle.module.css'

type Props = {
  onMouseDown: (event: React.MouseEvent) => void
  className?: string
  ariaLabel?: string
}

export function SidebarResizeHandle({
  onMouseDown,
  className,
  ariaLabel = 'Resize sidebar',
}: Props) {
  return (
    <div
      className={className ? `${styles.handle} ${className}` : styles.handle}
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
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
