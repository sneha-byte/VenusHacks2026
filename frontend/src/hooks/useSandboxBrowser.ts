import { useCallback, useRef } from 'react'
import { postSandboxEvent } from '../api/backend'
import type { BrowserEvent } from '../types'

export function useSandboxBrowser(sessionId?: string) {
  const frameRef = useRef<HTMLIFrameElement>(null)

  const relayEvent = useCallback(
    async (event: BrowserEvent) => {
      if (!sessionId) return
      await postSandboxEvent(event, sessionId)
      frameRef.current?.contentWindow?.postMessage(
        { source: 'browzen', event },
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
