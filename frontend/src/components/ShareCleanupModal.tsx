import { useState, useRef } from 'react'
import html2canvas from 'html2canvas-pro'
import ShareCleanupCard from './ShareCleanupCard'

interface ShareCleanupModalProps {
  onClose: () => void
  volunteerName: string
  avatarUrl: string
  todayResolvedCount: number
}

export default function ShareCleanupModal({
  onClose,
  volunteerName,
  avatarUrl,
  todayResolvedCount,
}: ShareCleanupModalProps) {
  const [reportsResolved, setReportsResolved] = useState(String(todayResolvedCount))
  const [hoursSpent, setHoursSpent] = useState('')
  const [bagsCollected, setBagsCollected] = useState('')
  const [generating, setGenerating] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const parsedReports = Math.max(0, parseInt(reportsResolved) || 0)
  const parsedHours = Math.max(0, parseFloat(hoursSpent) || 0)
  const parsedBags = Math.max(0, parseInt(bagsCollected) || 0)
  const canDownload = reportsResolved !== '' && hoursSpent !== '' && bagsCollected !== ''

  const cardProps = {
    volunteerName,
    avatarUrl,
    reportsResolved: parsedReports,
    hoursSpent: parsedHours,
    bagsCollected: parsedBags,
    date: today,
  }

  const handleDownload = async () => {
    if (!cardRef.current) return
    setGenerating(true)
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 1,
        useCORS: true,
        width: 1080,
        height: 1350,
        backgroundColor: null,
      })
      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const dateStr = new Date().toISOString().slice(0, 10)
        a.download = `my-cleanup-${dateStr}.png`
        a.click()
        URL.revokeObjectURL(url)
      }, 'image/png')
    } catch (err) {
      console.error('Failed to generate cleanup image:', err)
      alert('Failed to generate image.')
    }
    setGenerating(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Share My Cleanup</h3>

        {/* Form inputs */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reports resolved</label>
            <input
              type="number"
              min="0"
              value={reportsResolved}
              onChange={(e) => setReportsResolved(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="0"
            />
            <p className="text-xs text-gray-400 mt-1">
              Pre-filled from today's activity — edit if you cleaned unreported litter too
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hours spent</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={hoursSpent}
              onChange={(e) => setHoursSpent(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. 2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bags collected</label>
            <input
              type="number"
              min="0"
              value={bagsCollected}
              onChange={(e) => setBagsCollected(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. 3"
            />
          </div>
        </div>

        {/* Preview (scaled down for display) */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Preview</p>
          <div
            style={{
              width: 324,
              height: 405,
              overflow: 'hidden',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              margin: '0 auto',
            }}
          >
            <div style={{ transform: 'scale(0.3)', transformOrigin: 'top left' }}>
              <ShareCleanupCard {...cardProps} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={!canDownload || generating}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Download Image'}
          </button>
        </div>
      </div>

      {/* Off-screen card for html2canvas capture (no transform) */}
      <div
        style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        <ShareCleanupCard ref={cardRef} {...cardProps} />
      </div>
    </div>
  )
}
