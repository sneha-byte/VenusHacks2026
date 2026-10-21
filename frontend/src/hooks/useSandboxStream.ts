import { useEffect, useRef, useState } from 'react'
import { fetchSandboxStreamPng, sandboxSocketUrl } from '../api/backend'
import type { ActionLogItem } from '../types'

type Transport = 'websocket' | 'polling' | 'idle'

type AgentEvent = {
  type: string
  ts: number
  step?: number
  goal?: string | null
  actions?: string[]
  query?: string
  domain?: string
  message?: string
  events?: AgentEvent[]
}

const POLL_INTERVAL_MS = 1500
const MAX_LOG_ITEMS = 30

/** Turn one backend agent event into an action-log row (or null to skip it). */
function toLogItem(event: AgentEvent): ActionLogItem | null {
  const id = `${event.type}-${event.ts}`
  switch (event.type) {
    case 'agent_started':
      return { id, label: `Working on: ${event.query ?? 'your request'}`, status: 'pending' }
    case 'agent_step': {
      const what = event.goal || event.actions?.join(', ') || 'Next step'
      return { id, label: `Step ${event.step ?? ''}: ${what}`, status: 'done' }
    }
    case 'agent_done':
      return { id, label: 'Done', status: 'done' }
    case 'agent_error':
      return { id, label: 'Something went wrong. Try again.', status: 'waiting' }
    default:
      return null
  }
}

/** Once a run finishes, its "Working on…" row should no longer look in progress. */
function settle(items: ActionLogItem[]): ActionLogItem[] {
  return items.map((item) => (item.status === 'pending' ? { ...item, status: 'done' } : item))
}

function applyEvent(log: ActionLogItem[], event: AgentEvent): ActionLogItem[] {
  if (event.type === 'agent_started') log = []
  const item = toLogItem(event)
  if (!item) return log
  const next = event.type === 'agent_done' || event.type === 'agent_error' ? settle(log) : log
  return [...next, item].slice(-MAX_LOG_ITEMS)
}

/** Replay = events the server kept in Redis; show only the latest run. */
function replayLog(events: AgentEvent[]): ActionLogItem[] {
  return events.reduce<ActionLogItem[]>(applyEvent, [])
}

/**
 * Live preview of the sandbox browser.
 *
 * Prefers a WebSocket: the server pushes a JPEG frame only when the page changes,
 * plus agent step events for the action log. If the socket can't connect
 * (old backend, proxy that blocks WS), falls back to polling the PNG endpoint.
 * Pass { frames: false } to receive only agent events (no screenshots).
 */
export function useSandboxStream(
  sessionId: string | undefined,
  streamBase: string | undefined,
  paused: boolean,
  { frames = true }: { frames?: boolean } = {},
) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [transport, setTransport] = useState<Transport>('idle')
  const [agentLog, setAgentLog] = useState<ActionLogItem[]>([])
  const blobRef = useRef<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const pausedRef = useRef(paused)

  const showFrame = (blob: Blob) => {
    if (blobRef.current) URL.revokeObjectURL(blobRef.current)
    const url = URL.createObjectURL(blob)
    blobRef.current = url
    setBlobUrl(url)
    setStreamError(null)
    setLoading(false)
  }

  // Pause/resume over the open socket without reconnecting.
  useEffect(() => {
    pausedRef.current = paused
    const ws = socketRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: paused ? 'pause' : 'resume' }))
    }
  }, [paused])

  useEffect(() => {
    if (!sessionId) return

    let cancelled = false
    let pollTimer: number | undefined
    let reconnectTimer: number | undefined
    let attempts = 0

    const startPolling = () => {
      if (cancelled || pollTimer !== undefined || !streamBase) return
      setTransport('polling')
      const load = async () => {
        if (pausedRef.current) return
        try {
          const png = await fetchSandboxStreamPng(streamBase)
          if (!cancelled) showFrame(png)
        } catch {
          if (!cancelled) {
            setStreamError(
              'Live stream unavailable. Fix the Session API (Redis + backend), click Retry, then Refresh.',
            )
            setLoading(false)
          }
        }
      }
      void load()
      pollTimer = window.setInterval(() => void load(), POLL_INTERVAL_MS)
    }

    const connect = () => {
      if (cancelled) return
      if (frames) setLoading(true)
      let opened = false
      const ws = new WebSocket(sandboxSocketUrl(sessionId, frames))
      ws.binaryType = 'blob'
      socketRef.current = ws

      ws.onopen = () => {
        opened = true
        attempts = 0
        setTransport('websocket')
        if (pausedRef.current) ws.send(JSON.stringify({ type: 'pause' }))
      }

      ws.onmessage = (msg) => {
        if (cancelled) return
        if (msg.data instanceof Blob) {
          showFrame(msg.data)
          return
        }
        try {
          const event = JSON.parse(msg.data as string) as AgentEvent
          if (event.type === 'replay') setAgentLog(replayLog(event.events ?? []))
          else setAgentLog((log) => applyEvent(log, event))
        } catch {
          /* ignore malformed messages */
        }
      }

      ws.onclose = () => {
        if (cancelled) return
        socketRef.current = null
        if (!opened) {
          // Never connected: this backend/network doesn't do WebSockets.
          startPolling()
          return
        }
        // Dropped mid-session: back off and reconnect; Redis replay fills the gap.
        attempts += 1
        const delay = Math.min(1000 * 2 ** attempts, 10_000)
        reconnectTimer = window.setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      cancelled = true
      window.clearInterval(pollTimer)
      window.clearTimeout(reconnectTimer)
      socketRef.current?.close()
      socketRef.current = null
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current)
        blobRef.current = null
      }
      setBlobUrl(null)
      setAgentLog([])
      setTransport('idle')
    }
  }, [sessionId, streamBase, frames])

  return { blobUrl, streamError, loading, transport: sessionId ? transport : 'idle', agentLog }
}
