import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'browzen-sidebar-width'
const MIN_WIDTH = 200
const MAX_WIDTH = 520
const DEFAULT_WIDTH = 260

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function loadWidth() {
  const stored = Number(localStorage.getItem(STORAGE_KEY))
  return Number.isFinite(stored) ? clamp(stored, MIN_WIDTH, MAX_WIDTH) : DEFAULT_WIDTH
}

export function useSidebarResize() {
  const [width, setWidth] = useState(loadWidth)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width))
  }, [width])

  const onResizeStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = width

      const onMove = (moveEvent: MouseEvent) => {
        setWidth(clamp(startWidth + (moveEvent.clientX - startX), MIN_WIDTH, MAX_WIDTH))
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [width],
  )

  return { width, onResizeStart, minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH }
}
