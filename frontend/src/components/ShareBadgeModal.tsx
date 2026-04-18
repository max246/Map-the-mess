import { useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import ShareBadgeCard from './ShareBadgeCard'
import type { BadgeRead } from '../api/model'

interface ShareBadgeModalProps {
  badge: BadgeRead
  volunteerName: string
  onClose: () => void
}

export default function ShareBadgeModal({ badge, volunteerName, onClose }: ShareBadgeModalProps) {
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const shareCaption = `🏆 Achievement unlocked: ${badge.name} — ${badge.description}!

Join me cleaning up our streets 🗺️♻️ → mapthemess.uk

#MapTheMess #LitterPicking #CommunityCleanup #CleanStreets`

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(shareCaption)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  const awardedDate = badge.awarded_at
    ? new Date(badge.awarded_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

  const cardProps = {
    badgeName: badge.name,
    badgeDescription: badge.description,
    badgeImageUrl: `/badges/${badge.id}.png`,
    volunteerName,
    awardedDate,
  }

  const generateBlob = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null
    const canvas = await html2canvas(cardRef.current, {
      scale: 1,
      useCORS: true,
      width: 1080,
      height: 1350,
      backgroundColor: null,
    })
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
  }

  const handleDownload = async () => {
    setGenerating(true)
    try {
      const blob = await generateBlob()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `badge-${badge.id}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to generate image.')
    } finally {
      setGenerating(false)
    }
  }

  const handleNativeShare = async () => {
    setGenerating(true)
    try {
      const blob = await generateBlob()
      if (!blob) return
      const file = new File([blob], `badge-${badge.id}.png`, { type: 'image/png' })
      const shareData: ShareData = {
        title: `I just earned: ${badge.name}`,
        text: shareCaption,
        files: [file],
      }
      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData)
      } else {
        // Fallback — trigger download if the OS can't share files
        await handleDownload()
      }
    } catch {
      /* user cancelled or share failed — no-op */
    } finally {
      setGenerating(false)
    }
  }

  const canNativeShare =
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { canShare?: unknown }).canShare === 'function'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Share your achievement</h3>
        <p className="text-xs text-gray-500 mb-4">
          {badge.name} — {badge.description}
        </p>

        {/* Caption + copy */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Caption (tap to copy)
          </label>
          <div className="relative">
            <textarea
              readOnly
              value={shareCaption}
              onFocus={(e) => e.currentTarget.select()}
              rows={5}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 bg-gray-50 resize-none font-mono leading-snug pr-20"
            />
            <button
              type="button"
              onClick={handleCopyCaption}
              className="absolute top-2 right-2 px-2.5 py-1 bg-brand text-white rounded text-xs font-medium hover:opacity-90 transition"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="mb-4">
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
              <ShareBadgeCard {...cardProps} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end flex-wrap">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            disabled={generating}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            {generating ? 'Working…' : 'Download'}
          </button>
          {canNativeShare && (
            <button
              onClick={handleNativeShare}
              disabled={generating}
              className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {generating ? 'Working…' : 'Share'}
            </button>
          )}
        </div>
      </div>

      {/* Off-screen card for html2canvas capture (no transform) */}
      <div
        style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        <ShareBadgeCard ref={cardRef} {...cardProps} />
      </div>
    </div>
  )
}
