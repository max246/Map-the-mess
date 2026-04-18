import { Link } from 'react-router-dom'
import { useBadges } from '../context/BadgesContext'

export default function NewBadgesBanner() {
  const { unacknowledged } = useBadges()
  if (unacknowledged.length === 0) return null

  const count = unacknowledged.length
  const single = count === 1 ? unacknowledged[0] : null

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-50 border-b border-amber-200 text-amber-900"
    >
      <div className="max-w-5xl mx-auto px-4 py-2 text-sm flex items-center justify-between gap-3 flex-wrap">
        <span>
          <span aria-hidden className="mr-1">
            🏆
          </span>
          {single ? (
            <>
              You&rsquo;ve earned a new badge: <strong>{single.name}</strong> — view and share your
              achievement!
            </>
          ) : (
            <>
              You&rsquo;ve earned <strong>{count} new badges</strong> — view and share your
              achievements!
            </>
          )}
        </span>
        <Link
          to="/volunteers#badges"
          className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1 rounded"
        >
          View
        </Link>
      </div>
    </div>
  )
}
