import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import { getVolunteers } from '../api/endpoints/volunteers/volunteers'
import type { LeaderboardEntry } from '../api/model'

const { leaderboardApiVolunteersLeaderboardGet } = getVolunteers()

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const linkInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    leaderboardApiVolunteersLeaderboardGet({ months: 1, limit: 15 })
      .then((data) => setEntries(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const monthName = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const pageUrl = window.location.href
  const shareText = `Check out the Map the Mess leaderboard for ${monthName}!`

  const handleCopy = () => {
    linkInputRef.current?.select()
    navigator.clipboard.writeText(pageUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <PageMeta
        title="Leaderboard"
        description="See the top volunteers ranked by reports cleaned this month."
      />
      <Link to="/" className="text-sm text-brand underline mb-4 inline-block">
        ← Back to home
      </Link>

      <h1 className="text-2xl font-bold mb-1">Leaderboard</h1>
      <p className="text-gray-500 text-sm mb-6">
        Top volunteers for {monthName} — ranked by reports cleaned
      </p>

      {loading ? (
        <div className="text-center text-gray-400 py-16">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🧹</div>
          <p className="text-gray-500">No reports cleaned this month yet. Be the first!</p>
          <Link to="/map" className="text-brand underline mt-3 inline-block">
            Browse the map
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm text-gray-500">
                <th className="px-4 py-3 w-16">Rank</th>
                <th className="px-4 py-3">Volunteer</th>
                <th className="px-4 py-3 text-right">Cleaned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr
                  key={entry.rank}
                  className={entry.rank <= 3 ? 'bg-yellow-50' : 'hover:bg-gray-50'}
                >
                  <td className="px-4 py-3 font-medium">
                    {entry.rank <= 3 ? (
                      <span className="text-xl">{MEDALS[entry.rank - 1]}</span>
                    ) : (
                      <span className="text-gray-400">{entry.rank}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{entry.name}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="bg-brand bg-opacity-10 text-brand font-semibold px-2 py-0.5 rounded text-sm">
                      {entry.cleaned_count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Share */}
      {!loading && entries.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold mb-3">Share this leaderboard</h2>
          <div className="flex gap-2 mb-4">
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#1877F2] text-white hover:opacity-90 transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook
            </a>
            <a
              href={`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-black text-white hover:opacity-90 transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Post
            </a>
          </div>
          <div className="flex gap-2">
            <input
              ref={linkInputRef}
              type="text"
              readOnly
              value={pageUrl}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 bg-gray-50"
              onClick={() => linkInputRef.current?.select()}
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 transition whitespace-nowrap"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
