import { useEffect } from 'react'
import { flush, list } from './reportQueue'

export default function QueueManager() {
  useEffect(() => {
    let cancelled = false

    const tryFlush = () => {
      if (cancelled) return
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      void flush().catch(() => {
        /* swallow — state is already persisted and surfaced via the banner */
      })
    }

    // Boot: make sure the cached queue is hydrated and try to drain it.
    void list().then(tryFlush)

    window.addEventListener('online', tryFlush)
    return () => {
      cancelled = true
      window.removeEventListener('online', tryFlush)
    }
  }, [])

  return null
}
