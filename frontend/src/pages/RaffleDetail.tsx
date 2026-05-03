import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import { getRaffles } from '../api/endpoints/raffles/raffles'
import { rafflePrizeImageUrl } from '../api/client'
import { formatUtcDateTime, parseUtcDate } from '../utils/datetime'
import { useAuth } from '../context/AuthContext'
import type { RafflePrizeRead, RaffleRead } from '../api/model'

const {
  getRaffleApiRafflesRaffleIdGet,
  deleteRaffleApiRafflesRaffleIdDelete,
  addPrizeApiRafflesRaffleIdPrizesPost,
  updatePrizeApiRafflesRaffleIdPrizesPrizeIdPatch,
  deletePrizeApiRafflesRaffleIdPrizesPrizeIdDelete,
  uploadPrizeImageApiRafflesRaffleIdPrizesPrizeIdImagesPost,
  deletePrizeImageApiRafflesRaffleIdPrizesPrizeIdImagesImageIdDelete,
  drawRaffleApiRafflesRaffleIdDrawPost,
} = getRaffles()

function extractDetail(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback
  )
}

export default function RaffleDetail() {
  const { id } = useParams<{ id: string }>() as { id: string }
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [raffle, setRaffle] = useState<RaffleRead | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [drawing, setDrawing] = useState(false)

  const reload = useCallback(() => {
    return getRaffleApiRafflesRaffleIdGet(id)
      .then(setRaffle)
      .catch((err) => setError(extractDetail(err, 'Raffle not found')))
  }, [id])

  useEffect(() => {
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, [reload])

  const handleDraw = async () => {
    if (!confirm('Draw winners now? This is final.')) return
    setError('')
    setDrawing(true)
    try {
      const updated = await drawRaffleApiRafflesRaffleIdDrawPost(id)
      setRaffle(updated)
    } catch (err) {
      setError(extractDetail(err, 'Failed to draw raffle'))
    } finally {
      setDrawing(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this raffle? This cannot be undone.')) return
    try {
      await deleteRaffleApiRafflesRaffleIdDelete(id)
      navigate('/raffles')
    } catch (err) {
      setError(extractDetail(err, 'Failed to delete raffle'))
    }
  }

  if (loading) return <div className="text-center text-gray-400 py-12">Loading...</div>
  if (!raffle)
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-red-600">{error || 'Raffle not found'}</p>
        <Link to="/raffles" className="text-brand underline">
          ← Back to raffles
        </Link>
      </div>
    )

  const drawn = !!raffle.drawn_at
  const ended = drawn || parseUtcDate(raffle.end_date).getTime() <= Date.now()
  const prizes = raffle.prizes ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <PageMeta title={raffle.title} description={raffle.description} />
      <Link to="/raffles" className="text-sm text-brand underline mb-4 inline-block">
        ← Back to raffles
      </Link>

      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-2xl font-bold">{raffle.title}</h1>
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
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {drawn
          ? `Drawn ${formatUtcDateTime(raffle.drawn_at as string)}`
          : `Ends ${formatUtcDateTime(raffle.end_date)}`}
      </p>

      {raffle.description && <p className="mb-6 whitespace-pre-line">{raffle.description}</p>}

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="space-y-4">
        {prizes.map((p) => (
          <PrizeCard
            key={p.id}
            raffleId={id}
            prize={p}
            canManage={isAdmin && !drawn}
            onChanged={reload}
          />
        ))}

        {prizes.length === 0 && (
          <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
            <div className="text-4xl mb-2">🎁</div>
            <p className="text-gray-500 text-sm">No prizes yet.</p>
          </div>
        )}
      </div>

      {isAdmin && !drawn && (
        <AddPrizeForm raffleId={id} nextPosition={prizes.length + 1} onAdded={reload} />
      )}

      {isAdmin && (
        <div className="mt-8 pt-6 border-t border-gray-200 flex flex-wrap gap-3">
          {!drawn && (
            <button
              type="button"
              onClick={handleDraw}
              disabled={drawing || prizes.length === 0}
              className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {drawing ? 'Drawing...' : 'Draw winners'}
            </button>
          )}
          {drawn && (
            <Link
              to={`/raffles/${id}/winners`}
              className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
            >
              View winner contacts
            </Link>
          )}
          <button
            type="button"
            onClick={handleDelete}
            className="border border-red-300 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition"
          >
            Delete raffle
          </button>
        </div>
      )}
    </div>
  )
}

function PrizeCard({
  raffleId,
  prize,
  canManage,
  onChanged,
}: {
  raffleId: string
  prize: RafflePrizeRead
  canManage: boolean
  onChanged: () => Promise<unknown>
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(prize.title)
  const [description, setDescription] = useState(prize.description)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const save = async () => {
    setBusy(true)
    setErr('')
    try {
      await updatePrizeApiRafflesRaffleIdPrizesPrizeIdPatch(raffleId, prize.id, {
        title: title.trim(),
        description: description.trim(),
      })
      await onChanged()
      setEditing(false)
    } catch (e) {
      setErr(extractDetail(e, 'Failed to update prize'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm('Delete this prize?')) return
    try {
      await deletePrizeApiRafflesRaffleIdPrizesPrizeIdDelete(raffleId, prize.id)
      await onChanged()
    } catch (e) {
      setErr(extractDetail(e, 'Failed to delete prize'))
    }
  }

  const upload = async (file: File) => {
    setBusy(true)
    setErr('')
    try {
      await uploadPrizeImageApiRafflesRaffleIdPrizesPrizeIdImagesPost(
        raffleId,
        prize.id,
        { file }
      )
      await onChanged()
    } catch (e) {
      setErr(extractDetail(e, 'Failed to upload image'))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeImage = async (imageId: string) => {
    try {
      await deletePrizeImageApiRafflesRaffleIdPrizesPrizeIdImagesImageIdDelete(
        raffleId,
        prize.id,
        imageId
      )
      await onChanged()
    } catch (e) {
      setErr(extractDetail(e, 'Failed to remove image'))
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Prize {prize.position || ''}
        </span>
      </div>

      {editing ? (
        <div className="space-y-2 mb-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Prize title"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Description"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy || !title.trim()}
              className="bg-brand text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setTitle(prize.title)
                setDescription(prize.description)
              }}
              className="border border-gray-300 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="font-semibold">{prize.title}</h3>
          {prize.description && (
            <p className="text-sm text-gray-600 mb-2 whitespace-pre-line">{prize.description}</p>
          )}
        </>
      )}

      {(prize.images?.length ?? 0) > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(prize.images ?? []).map((img) => (
            <div key={img.id} className="relative">
              <img
                src={rafflePrizeImageUrl(img.url)}
                alt=""
                className="w-full h-24 object-cover rounded-lg"
              />
              {canManage && (
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  aria-label="Remove image"
                  className="absolute top-1 right-1 bg-white/90 hover:bg-white text-red-600 rounded-full w-6 h-6 flex items-center justify-center text-xs shadow"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {prize.winner && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm mt-2">
          🏆 <span className="font-medium">Winner:</span> {prize.winner.full_name}
        </div>
      )}

      {err && <p className="text-red-600 text-sm mt-2">{err}</p>}

      {canManage && (
        <div className="flex flex-wrap gap-2 mt-3">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm text-brand hover:underline"
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="text-sm text-brand hover:underline disabled:opacity-50"
          >
            Upload image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void upload(f)
            }}
          />
          <button
            type="button"
            onClick={remove}
            className="text-sm text-red-600 hover:underline ml-auto"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function AddPrizeForm({
  raffleId,
  nextPosition,
  onAdded,
}: {
  raffleId: string
  nextPosition: number
  onAdded: () => Promise<unknown>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErr('')
    try {
      await addPrizeApiRafflesRaffleIdPrizesPost(raffleId, {
        title: title.trim(),
        description: description.trim(),
        position: nextPosition,
      })
      setTitle('')
      setDescription('')
      await onAdded()
    } catch (e) {
      setErr(extractDetail(e, 'Failed to add prize'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2"
    >
      <h3 className="text-sm font-semibold">Add a prize</h3>
      <input
        type="text"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        placeholder="Prize title"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        placeholder="Description (optional)"
      />
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <button
        type="submit"
        disabled={submitting || !title.trim()}
        className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
      >
        {submitting ? 'Adding...' : 'Add prize'}
      </button>
    </form>
  )
}
