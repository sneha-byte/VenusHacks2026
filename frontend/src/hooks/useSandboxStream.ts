import { useEffect, useRef, useState } from 'react'
import { fetchSandboxStreamPng } from '../api/backend'

/** Polls the sandbox screenshot endpoint and exposes a blob URL for <img src>. */
export function useSandboxStream(streamBase: string | undefined, paused: boolean) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const blobRef = useRef<string | null>(null)

  useEffect(() => {
    if (!streamBase || paused) {
      setBlobUrl(null)
      setStreamError(null)
      setLoading(false)
      return
    }

    let cancelled = false

    const revoke = () => {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current)
        blobRef.current = null
      }
    }

    const load = async () => {
      setLoading(true)
      try {
        const png = await fetchSandboxStreamPng(streamBase)
        if (cancelled) return
        revoke()
        const url = URL.createObjectURL(png)
        blobRef.current = url
        setBlobUrl(url)
        setStreamError(null)
      } catch {
        if (cancelled) return
        revoke()
        setBlobUrl(null)
        setStreamError(
          'Live stream unavailable. Fix the Session API (Redis + backend), click Retry, then Refresh.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const interval = window.setInterval(() => void load(), 1500)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      revoke()
    }
  }, [streamBase, paused])

  return { blobUrl, streamError, loading }
}
