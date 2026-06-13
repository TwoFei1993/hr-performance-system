'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { SSEEvent } from '@/types'

const MAX_EVENTS = 100
const RECONNECT_DELAY_MS = 3000
const MAX_RETRIES = 5

interface UseSSEReturn {
  events: SSEEvent[]
  isConnected: boolean
  error: string | null
  clearEvents: () => void
}

export function useSSE(): UseSSEReturn {
  const clientIdRef = useRef<string>(uuidv4())
  const lastEventIdRef = useRef<string>('')
  const retryCountRef = useRef<number>(0)
  const esRef = useRef<EventSource | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [events, setEvents] = useState<SSEEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearEvents = useCallback(() => {
    setEvents([])
  }, [])

  useEffect(() => {
    let cancelled = false

    function connect() {
      if (cancelled) return

      const params = new URLSearchParams({
        client_id: clientIdRef.current,
      })
      if (lastEventIdRef.current) {
        params.set('last_event_id', lastEventIdRef.current)
      }

      // SSE 通过 Next.js 代理转发（相对路径），兼容本地和 Cloudflare Pages
      const url = `/api/stream/notifications?${params.toString()}`
      const es = new EventSource(url)
      esRef.current = es

      es.onopen = () => {
        if (cancelled) { es.close(); return }
        setIsConnected(true)
        setError(null)
        retryCountRef.current = 0
      }

      es.onmessage = (ev: MessageEvent<string>) => {
        if (cancelled) return
        try {
          const parsed = JSON.parse(ev.data) as SSEEvent
          if (ev.lastEventId) {
            lastEventIdRef.current = ev.lastEventId
          }
          setEvents((prev) => {
            const next = [...prev, parsed]
            return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next
          })
        } catch {
          // 忽略解析失败的消息
        }
      }

      es.onerror = () => {
        if (cancelled) return
        es.close()
        esRef.current = null
        setIsConnected(false)

        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1
          setError(`连接断开，${RECONNECT_DELAY_MS / 1000}s 后重试 (${retryCountRef.current}/${MAX_RETRIES})`)
          retryTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
        } else {
          setError('SSE 连接失败，已达最大重试次数')
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
      }
      esRef.current?.close()
      esRef.current = null
    }
  }, [])

  return { events, isConnected, error, clearEvents }
}
