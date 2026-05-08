import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import DateTimePicker from '../components/DateTimePicker'
import { useAuth } from '../context/AuthContext'
import { getRaffles } from '../api/endpoints/raffles/raffles'

const { createRaffleApiRafflesPost } = getRaffles()

export default function CreateRaffle() {
  const { isAdmin, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoggedIn) navigate('/login', { replace: true })
    else if (!isAdmin) navigate('/raffles', { replace: true })
  }, [isLoggedIn, isAdmin, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const raffle = await createRaffleApiRafflesPost({
        title: title.trim(),
        description: description.trim(),
        end_date: new Date(endDate).toISOString(),
      })
      navigate(`/raffles/${raffle.id}`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to create raffle'
      setError(msg)
      setSubmitting(false)
    }
  }

  if (!isAdmin) return null

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <PageMeta title="Create Raffle" description="Create a new raffle." />
      <Link to="/raffles" className="text-sm text-brand underline mb-4 inline-block">
        ← Back to raffles
      </Link>

      <h1 className="text-2xl font-bold mb-6">Create Raffle</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. Spring Cleanup Raffle"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Tell users about the raffle..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">End date</label>
          <DateTimePicker value={endDate} onChange={setEndDate} mode="datetime" />
          <p className="text-xs text-gray-500 mt-1">
            After creation you can add prizes and prize images.
          </p>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !title.trim() || !endDate}
          className="w-full bg-brand text-white py-2 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Raffle'}
        </button>
      </form>
    </div>
  )
}
