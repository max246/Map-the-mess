import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import { getRaffles } from '../api/endpoints/raffles/raffles'
import { rafflePrizeImageUrl } from '../api/client'
import { formatUtcDate, parseUtcDate } from '../utils/datetime'
import { useAuth } from '../context/AuthContext'
import type { RaffleRead } from '../api/model'

const { listRafflesApiRafflesGet } = getRaffles()

type Tab = 'active' | 'ended'

export default function RafflesList() {
  const { isAdmin } = useAuth()
  const [raffles, setRaffles] = useState<RaffleRead[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('active')

  useEffect(() => {
    listRafflesApiRafflesGet()
      .then(setRaffles)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const [now] = useState(() => Date.now())

  const { active, ended } = useMemo(() => {
    const activeList: RaffleRead[] = []
    const endedList: RaffleRead[] = []
    for (const r of raffles) {
      if (r.drawn_at || parseUtcDate(r.end_date).getTime() <= now) endedList.push(r)
      else activeList.push(r)
    }
    activeList.sort(
      (a, b) => parseUtcDate(a.end_date).getTime() - parseUtcDate(b.end_date).getTime()
    )
    endedList.sort(
      (a, b) => parseUtcDate(b.end_date).getTime() - parseUtcDate(a.end_date).getTime()
    )
    return { active: activeList, ended: endedList }
  }, [raffles, now])

  const visible = tab === 'active' ? active : ended

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <PageMeta title="Raffles" description="Free raffles for verified Map the Mess users." />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🎁 Raffles</h1>
        {isAdmin && (
          <Link
            to="/raffles/new"
            className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            Create Raffle
          </Link>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {(['active', 'ended'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t === 'active' ? 'Active' : 'Ended'}
            <span
              className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                tab === t ? 'bg-white/25' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {t === 'active' ? active.length : ended.length}
            </span>
          </button>
        ))}
      </div>

      {loading && <div className="text-center text-gray-400 py-8">Loading...</div>}

      {!loading && visible.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🎁</div>
          <p className="text-gray-500">
            {tab === 'active' ? 'No raffles running right now.' : 'No raffles have ended yet.'}
          </p>
          {isAdmin && tab === 'active' && (
            <Link to="/raffles/new" className="text-brand underline text-sm mt-2 inline-block">
              Create one
            </Link>
          )}
        </div>
      )}

      {!loading && visible.length > 0 && (
        <ul className="space-y-3">
          {visible.map((r) => (
            <RaffleRow key={r.id} raffle={r} />
          ))}
        </ul>
      )}
    </div>
  )
}

function RaffleRow({ raffle }: { raffle: RaffleRead }) {
  const [now] = useState(() => Date.now())
  const prizes = raffle.prizes ?? []
  const cover = prizes.flatMap((p) => p.images ?? [])[0]
  const drawn = !!raffle.drawn_at
  const ended = drawn || parseUtcDate(raffle.end_date).getTime() <= now
  return (
    <li>
      <Link
        to={`/raffles/${raffle.id}`}
        className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition"
      >
        {cover ? (
          <img
            src={rafflePrizeImageUrl(cover.url)}
            alt=""
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-amber-100 flex items-center justify-center text-3xl flex-shrink-0">
            🎁
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{raffle.title}</p>
          <p className="text-sm text-gray-500">
            {prizes.length} prize{prizes.length === 1 ? '' : 's'}
            {' · '}
            {drawn
              ? `drawn ${formatUtcDate(raffle.drawn_at as string)}`
              : ended
                ? 'awaiting draw'
                : `ends ${formatUtcDate(raffle.end_date)}`}
          </p>
        </div>
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
            drawn
              ? 'bg-gray-100 text-gray-600'
              : ended
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-green-100 text-green-800'
          }`}
        >
          {drawn ? 'Drawn' : ended ? 'Pending draw' : 'Active'}
        </span>
      </Link>
    </li>
  )
}
