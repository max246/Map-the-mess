import { useFlushProgress } from '../offline/useFlushProgress'
import { flush } from '../offline/reportQueue'

const handleRetry = () => {
  void flush()
}

export default function PendingReportsBanner() {
  const { items, online, flushing, progress } = useFlushProgress()

  const count = items.length
  if (count === 0 && !flushing) return null

  const failed = items.filter((r) => r.status === 'failed')

  if (flushing && progress) {
    const { total, completed, bytesSent, bytesTotal } = progress
    const fine =
      bytesSent !== undefined && bytesTotal && bytesTotal > 0 ? bytesSent / bytesTotal : 0
    const percent = total > 0 ? Math.min(100, ((completed + fine) / total) * 100) : 0
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-blue-50 border-b border-blue-200 text-blue-900"
      >
        <div className="max-w-5xl mx-auto px-4 py-2 flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>⬆ Uploading your saved reports…</span>
            <span>
              {completed} / {total}
            </span>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-200 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  if (!online) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-amber-50 border-b border-amber-200 text-amber-900"
      >
        <div className="max-w-5xl mx-auto px-4 py-2 text-sm flex items-start gap-2">
          <span aria-hidden>📡</span>
          <span>
            You&rsquo;re offline. <strong>{count}</strong>{' '}
            {count === 1 ? 'report is' : 'reports are'} saved on this device — they&rsquo;ll upload
            automatically when you&rsquo;re back on the internet. You can safely close the app;
            nothing will be lost.
          </span>
        </div>
      </div>
    )
  }

  if (failed.length > 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-red-50 border-b border-red-200 text-red-900"
      >
        <div className="max-w-5xl mx-auto px-4 py-2 text-sm flex items-center justify-between gap-3 flex-wrap">
          <span>
            ⚠ <strong>{failed.length}</strong> {failed.length === 1 ? 'report' : 'reports'}{' '}
            couldn&rsquo;t upload. Check your connection and try again.
          </span>
          <button
            type="button"
            onClick={handleRetry}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1 rounded"
          >
            Retry now
          </button>
        </div>
      </div>
    )
  }

  // Online + queued but not yet flushing (transient state right before flush kicks off).
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-blue-50 border-b border-blue-200 text-blue-900"
    >
      <div className="max-w-5xl mx-auto px-4 py-2 text-sm flex items-center justify-between gap-3 flex-wrap">
        <span>
          <strong>{count}</strong> {count === 1 ? 'report is' : 'reports are'} waiting to upload.
        </span>
        <button
          type="button"
          onClick={handleRetry}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded"
        >
          Upload now
        </button>
      </div>
    </div>
  )
}
