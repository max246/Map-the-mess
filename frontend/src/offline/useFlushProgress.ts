import { useEffect, useState } from 'react'
import { subscribe, getSnapshot, type QueueSnapshot } from './reportQueue'

export type UseFlushProgressResult = QueueSnapshot & {
  online: boolean
}

export const useFlushProgress = (): UseFlushProgressResult => {
  const [snapshot, setSnapshot] = useState<QueueSnapshot>(() => getSnapshot())
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  )

  useEffect(() => {
    const unsubscribe = subscribe(setSnapshot)
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { ...snapshot, online }
}
