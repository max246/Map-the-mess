import { openDB, type IDBPDatabase } from 'idb'
import api from '../api/client'

const DB_NAME = 'map-the-mess'
const DB_VERSION = 1
const STORE = 'pending_reports'

export type PendingReportBody = {
  latitude: number
  longitude: number
  report_type: string
  description?: string
  what3words?: string | null
}

export type PendingReportInput = {
  body: PendingReportBody
  photos: Blob[]
}

export type PendingReport = PendingReportInput & {
  id: string
  createdAt: number
  status: 'pending' | 'syncing' | 'failed'
  lastError?: string
  attempts: number
}

export type FlushProgress = {
  total: number
  completed: number
  currentReportId?: string
  bytesSent?: number
  bytesTotal?: number
}

export type QueueSnapshot = {
  items: PendingReport[]
  flushing: boolean
  progress: FlushProgress | null
}

let dbPromise: Promise<IDBPDatabase> | null = null

const hasIndexedDb = () => typeof indexedDB !== 'undefined'

const getDb = () => {
  if (!hasIndexedDb()) {
    return Promise.reject(new Error('IndexedDB unavailable'))
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

const listeners = new Set<(snapshot: QueueSnapshot) => void>()
let cachedItems: PendingReport[] = []
let flushing = false
let currentProgress: FlushProgress | null = null
let inflightFlush: Promise<{ synced: number; failed: number }> | null = null

const snapshot = (): QueueSnapshot => ({
  items: cachedItems.slice(),
  flushing,
  progress: currentProgress,
})

const emit = () => {
  const s = snapshot()
  listeners.forEach((cb) => cb(s))
}

const refresh = async () => {
  if (!hasIndexedDb()) return
  const db = await getDb()
  const all = (await db.getAll(STORE)) as PendingReport[]
  cachedItems = all.sort((a, b) => a.createdAt - b.createdAt)
  emit()
}

const makeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `pr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export const enqueue = async (input: PendingReportInput): Promise<PendingReport> => {
  const record: PendingReport = {
    id: makeId(),
    createdAt: Date.now(),
    status: 'pending',
    attempts: 0,
    body: input.body,
    photos: input.photos,
  }
  const db = await getDb()
  await db.put(STORE, record)
  await refresh()
  return record
}

export const list = async (): Promise<PendingReport[]> => {
  await refresh()
  return cachedItems.slice()
}

export const remove = async (id: string): Promise<void> => {
  const db = await getDb()
  await db.delete(STORE, id)
  await refresh()
}

export const clear = async (): Promise<void> => {
  const db = await getDb()
  await db.clear(STORE)
  await refresh()
}

const updateItem = async (id: string, patch: Partial<PendingReport>) => {
  const db = await getDb()
  const existing = (await db.get(STORE, id)) as PendingReport | undefined
  if (!existing) return
  await db.put(STORE, { ...existing, ...patch })
  await refresh()
}

const unitsFor = (report: PendingReport) => Math.max(report.photos.length, 1)

const postReport = (
  report: PendingReport,
  onUploadProgress: (loaded: number, total: number) => void
) => {
  const formData = new FormData()
  formData.append('latitude', report.body.latitude.toString())
  formData.append('longitude', report.body.longitude.toString())
  formData.append('report_type', report.body.report_type)
  if (report.body.description) formData.append('description', report.body.description)
  if (report.body.what3words) formData.append('what3words', report.body.what3words)
  if (report.photos[0]) formData.append('image', report.photos[0])

  return api.post('/api/reports/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
    onUploadProgress: (e) => onUploadProgress(e.loaded, e.total ?? 0),
  })
}

const postExtraImage = (
  reportId: string,
  file: Blob,
  onUploadProgress: (loaded: number, total: number) => void
) => {
  const formData = new FormData()
  formData.append('image_type', 'report')
  formData.append('file', file)
  return api.post(`/api/reports/${reportId}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
    onUploadProgress: (e) => onUploadProgress(e.loaded, e.total ?? 0),
  })
}

const isNetworkError = (err: unknown): boolean => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const e = err as { code?: string; message?: string; response?: unknown }
  if (!e) return false
  if (!e.response) return true
  if (e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED') return true
  return false
}

export const flush = async (): Promise<{ synced: number; failed: number }> => {
  if (inflightFlush) return inflightFlush
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { synced: 0, failed: 0 }
  }

  inflightFlush = (async () => {
    await refresh()
    const pending = cachedItems.filter((r) => r.status !== 'syncing')
    if (pending.length === 0) {
      return { synced: 0, failed: 0 }
    }

    flushing = true
    const total = pending.reduce((acc, r) => acc + unitsFor(r), 0)
    let completed = 0
    currentProgress = { total, completed }
    emit()

    let synced = 0
    let failed = 0

    for (const report of pending) {
      currentProgress = {
        total,
        completed,
        currentReportId: report.id,
        bytesSent: 0,
        bytesTotal: 0,
      }
      await updateItem(report.id, { status: 'syncing' })
      emit()

      try {
        const firstPhoto = report.photos[0]
        const firstTotal = firstPhoto ? firstPhoto.size : 0
        const created = await postReport(report, (loaded, totalBytes) => {
          currentProgress = {
            total,
            completed,
            currentReportId: report.id,
            bytesSent: loaded,
            bytesTotal: totalBytes || firstTotal,
          }
          emit()
        })
        completed += 1
        currentProgress = { total, completed, currentReportId: report.id }
        emit()

        const createdReport = created.data as { id: string | number }
        for (let i = 1; i < report.photos.length; i++) {
          const photo = report.photos[i]
          const photoTotal = photo.size
          await postExtraImage(String(createdReport.id), photo, (loaded, totalBytes) => {
            currentProgress = {
              total,
              completed,
              currentReportId: report.id,
              bytesSent: loaded,
              bytesTotal: totalBytes || photoTotal,
            }
            emit()
          })
          completed += 1
          currentProgress = { total, completed, currentReportId: report.id }
          emit()
        }

        await remove(report.id)
        synced += 1
      } catch (err) {
        failed += 1
        const message = (err as Error)?.message ?? 'Unknown error'
        if (isNetworkError(err)) {
          // Leave as pending so we retry later; don't burn an attempt counter.
          await updateItem(report.id, { status: 'pending', lastError: message })
        } else {
          // Server returned a real error — mark failed so the user sees a retry button.
          await updateItem(report.id, {
            status: 'failed',
            lastError: message,
            attempts: (report.attempts ?? 0) + 1,
          })
        }
        // Don't keep hammering the network if we're clearly offline.
        if (isNetworkError(err)) break
      }
    }

    flushing = false
    currentProgress = null
    emit()
    return { synced, failed }
  })()

  try {
    return await inflightFlush
  } finally {
    inflightFlush = null
  }
}

export const subscribe = (cb: (snapshot: QueueSnapshot) => void): (() => void) => {
  listeners.add(cb)
  cb(snapshot())
  return () => {
    listeners.delete(cb)
  }
}

export const getSnapshot = (): QueueSnapshot => snapshot()

// Prime the cache once we're in a real browser context.
if (hasIndexedDb()) {
  void refresh()
}
