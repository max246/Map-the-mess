import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import { getRaffles } from '../api/endpoints/raffles/raffles'
import { formatUtcDateTime } from '../utils/datetime'
import { useAuth } from '../context/AuthContext'
import type { RaffleRead, RaffleWinnerContact } from '../api/model'

const {
  getRaffleApiRafflesRaffleIdGet,
  listWinnerContactsApiRafflesRaffleIdWinnersGet,
  redrawPrizeApiRafflesRaffleIdPrizesPrizeIdRedrawPost,
} = getRaffles()

function extractDetail(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback
  )
}

export default function RaffleWinners() {
  const { id } = useParams<{ id: string }>() as { id: string }
  const { isAdmin, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [raffle, setRaffle] = useState<RaffleRead | null>(null)
  const [contacts, setContacts] = useState<RaffleWinnerContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [redrawing, setRedrawing] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoggedIn) navigate('/login', { replace: true })
    else if (!isAdmin) navigate(`/raffles/${id}`, { replace: true })
  }, [isLoggedIn, isAdmin, id, navigate])

  const reload = useCallback(async () => {
    setError('')
    try {
      const [r, c] = await Promise.all([
        getRaffleApiRafflesRaffleIdGet(id),
        listWinnerContactsApiRafflesRaffleIdWinnersGet(id),
      ])
      setRaffle(r)
      setContacts(c)
    } catch (err) {
      setError(extractDetail(err, 'Failed to load winners'))
    }
  }, [id])

  useEffect(() => {
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, [reload])

  const handleRedraw = async (prizeId: string) => {
    if (
      !confirm(
        "Pick a fresh winner for this prize? The current winner will be replaced and won't be re-picked."
      )
    )
      return
    setRedrawing(prizeId)
    setError('')
    try {
      await redrawPrizeApiRafflesRaffleIdPrizesPrizeIdRedrawPost(id, prizeId)
      await reload()
    } catch (err) {
      setError(extractDetail(err, 'Failed to redraw prize'))
    } finally {
      setRedrawing(null)
    }
  }

  if (!isAdmin) return null

  if (loading) return <div className="text-center text-gray-400 py-12">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <PageMeta title="Raffle Winners" description="Admin winner contact details." />
      <Link to={`/raffles/${id}`} className="text-sm text-brand underline mb-4 inline-block">
        ← Back to raffle
      </Link>

      <h1 className="text-2xl font-bold mb-2">{raffle?.title ?? 'Raffle'} — Winners</h1>
      {raffle?.drawn_at && (
        <p className="text-sm text-gray-500 mb-4">Drawn {formatUtcDateTime(raffle.drawn_at)}</p>
      )}

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {contacts.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-lg">
          <div className="text-4xl mb-2">🎲</div>
          <p className="text-gray-500 text-sm">
            {raffle?.drawn_at
              ? 'This raffle has been drawn but has no winners.'
              : 'This raffle has not been drawn yet.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Prize</th>
                <th className="px-4 py-2 font-semibold">Winner</th>
                <th className="px-4 py-2 font-semibold">Email</th>
                <th className="px-4 py-2 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.map((c) => (
                <tr key={c.prize_id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.prize_title}</div>
                    {c.prize_position > 0 && (
                      <div className="text-xs text-gray-400">Position {c.prize_position}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">{c.full_name}</td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${c.email}`} className="text-brand hover:underline">
                      {c.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRedraw(c.prize_id)}
                      disabled={redrawing === c.prize_id}
                      className="text-sm border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      {redrawing === c.prize_id ? 'Redrawing...' : 'Redraw'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Redrawing replaces the winner. Anyone who has already held a prize in this raffle is excluded
        from the new pick.
      </p>
    </div>
  )
}
