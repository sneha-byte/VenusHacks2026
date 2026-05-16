import { useCallback, useRef } from 'react'
import { sendBrowserEvent } from '../api/client'
import type { BrowserEvent } from '../types'

export function useSandboxBrowser(sessionId?: string) {
  const frameRef = useRef<HTMLIFrameElement>(null)

  const relayEvent = useCallback(
    async (event: BrowserEvent) => {
      if (!sessionId) return
      await sendBrowserEvent(event, sessionId)
      frameRef.current?.contentWindow?.postMessage(
        { source: 'easyweb', event },
        '*',
      )
    },
    [sessionId],
  )

  return {
    frameRef,
    relayEvent,
  }
}
