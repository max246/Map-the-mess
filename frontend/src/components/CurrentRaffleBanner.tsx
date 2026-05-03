import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRaffles } from '../api/endpoints/raffles/raffles'
import { rafflePrizeImageUrl } from '../api/client'
import { parseUtcDate } from '../utils/datetime'
import type { RaffleRead } from '../api/model'

const { listRafflesApiRafflesGet } = getRaffles()

function pickActiveRaffle(raffles: RaffleRead[]): RaffleRead | null {
  const now = Date.now()
  const active = raffles
    .filter((r) => !r.drawn_at && parseUtcDate(r.end_date).getTime() > now)
    .sort((a, b) => parseUtcDate(a.end_date).getTime() - parseUtcDate(b.end_date).getTime())
  return active[0] ?? null
}

function formatTimeLeft(endDate: string): string {
  const ms = parseUtcDate(endDate).getTime() - Date.now()
  if (ms <= 0) return 'Ending soon'
  const days = Math.floor(ms / 86_400_000)
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} left`
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'} left`
  const minutes = Math.max(1, Math.floor(ms / 60_000))
  return `${minutes} minute${minutes === 1 ? '' : 's'} left`
}

export default function CurrentRaffleBanner() {
  const [raffle, setRaffle] = useState<RaffleRead | null>(null)

  useEffect(() => {
    listRafflesApiRafflesGet()
      .then((data) => setRaffle(pickActiveRaffle(data)))
      .catch(() => {})
  }, [])

  if (!raffle) return null

  const prizes = raffle.prizes ?? []
  const firstImage = prizes
    .flatMap((p) => p.images ?? [])
    .sort(
      (a, b) => parseUtcDate(a.created_at).getTime() - parseUtcDate(b.created_at).getTime()
    )[0]

  return (
    <Link
      to={`/raffles/${raffle.id}`}
      className="block w-full max-w-2xl mt-12 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4 hover:shadow-md transition text-left"
    >
      <div className="flex items-center gap-4">
        {firstImage ? (
          <img
            src={rafflePrizeImageUrl(firstImage.url)}
            alt=""
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-amber-100 flex items-center justify-center text-3xl flex-shrink-0">
            🎁
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Raffle running
            </span>
            <span className="text-xs text-amber-600">{formatTimeLeft(raffle.end_date)}</span>
          </div>
          <p className="font-semibold truncate">{raffle.title}</p>
          <p className="text-sm text-gray-600">
            {prizes.length} prize{prizes.length === 1 ? '' : 's'} · enter for free
          </p>
        </div>
        <span className="text-amber-700 font-semibold text-sm hidden sm:inline">View →</span>
      </div>
    </Link>
  )
}
