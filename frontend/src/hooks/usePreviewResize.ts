import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'browzen-preview-width'
const MIN_WIDTH = 280
const MAX_WIDTH = 720
const DEFAULT_WIDTH = 420

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function loadWidth() {
  const stored = Number(localStorage.getItem(STORAGE_KEY))
  return Number.isFinite(stored) ? clamp(stored, MIN_WIDTH, MAX_WIDTH) : DEFAULT_WIDTH
}

/** Resize handle sits on the left edge of the preview column; drag left to widen. */
export function usePreviewResize() {
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
        setWidth(clamp(startWidth + (startX - moveEvent.clientX), MIN_WIDTH, MAX_WIDTH))
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
