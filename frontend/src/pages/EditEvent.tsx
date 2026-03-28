import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getCommunities } from '../api/endpoints/communities/communities'
import { getReports } from '../api/endpoints/reports/reports'
import { useAuth } from '../context/AuthContext'
import { thumbnailUrl } from '../api/client'
import MeetingPointPicker from '../components/MeetingPointPicker'
import MarkdownRenderer from '../components/MarkdownRenderer'
import type { CommunityRead, ReportRead } from '../api/model'

const {
  listCommunitiesApiCommunitiesGet,
  getEventApiCommunitiesCommunityIdEventsEventIdGet,
  updateEventApiCommunitiesCommunityIdEventsEventIdPatch,
} = getCommunities()
const { listReportsApiReportsGet } = getReports()

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function EditEvent() {
  const { id, eventId } = useParams<{ id: string; eventId: string }>()
  const communityId = Number(id)
  const numericEventId = Number(eventId)
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()

  const [community, setCommunity] = useState<CommunityRead | null>(null)
  const [allReports, setAllReports] = useState<ReportRead[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [descriptionTab, setDescriptionTab] = useState<'write' | 'preview'>('write')
  const [date, setDate] = useState('')
  const [meetingPoint, setMeetingPoint] = useState({ lat: 53.5, lng: -1.5 })
  const [selectedReportIds, setSelectedReportIds] = useState<Set<number>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoggedIn) navigate('/login', { replace: true })
  }, [isLoggedIn, navigate])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [communities, reports, event] = await Promise.all([
          listCommunitiesApiCommunitiesGet({ search: '' }),
          listReportsApiReportsGet({ status: 'pending' }),
          getEventApiCommunitiesCommunityIdEventsEventIdGet(communityId, numericEventId),
        ])

        const c = communities.find((x) => x.id === communityId)
        if (c) setCommunity(c)
        setAllReports(reports)

        setTitle(event.title)
        setDescription(event.description || '')
        setDate(new Date(event.date).toISOString().slice(0, 16))
        setMeetingPoint({ lat: event.meeting_latitude, lng: event.meeting_longitude })
        setSelectedReportIds(new Set(event.report_ids || []))
      } catch {
        setError('Failed to load event')
      }
      setLoading(false)
    }
    fetchData()
  }, [communityId, numericEventId])

  const nearbyReports = useMemo(() => {
    if (!community) return []
    return allReports.filter(
      (r) =>
        haversineKm(community.latitude, community.longitude, r.latitude, r.longitude) <=
          community.radius_km || selectedReportIds.has(r.id)
    )
  }, [allReports, community, selectedReportIds])

  const toggleReport = (reportId: number) => {
    setSelectedReportIds((prev) => {
      const next = new Set(prev)
      if (next.has(reportId)) next.delete(reportId)
      else next.add(reportId)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await updateEventApiCommunitiesCommunityIdEventsEventIdPatch(communityId, numericEventId, {
        title: title.trim(),
        description: description.trim() || undefined,
        date: new Date(date).toISOString(),
        meeting_latitude: meetingPoint.lat,
        meeting_longitude: meetingPoint.lng,
        report_ids: Array.from(selectedReportIds),
      })
      navigate(`/communities/${communityId}`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to update event'
      setError(msg)
      setSubmitting(false)
    }
  }

  if (!isLoggedIn) return null
  if (loading) return <div className="text-center text-gray-400 py-16">Loading...</div>
  if (error && !title) return <div className="text-center text-gray-500 py-16">{error}</div>

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link
        to={`/communities/${communityId}`}
        className="text-sm text-brand underline mb-4 inline-block"
      >
        ← Back to community
      </Link>

      <h1 className="text-2xl font-bold mb-6">Edit Event</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Event title"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <div className="flex items-center border-b border-gray-200 mb-2">
            <button
              type="button"
              onClick={() => setDescriptionTab('write')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
                descriptionTab === 'write'
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setDescriptionTab('preview')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
                descriptionTab === 'preview'
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Preview
            </button>
            <span className="ml-auto text-xs text-gray-400">Supports Markdown</span>
          </div>
          {descriptionTab === 'write' ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
              placeholder="Describe the event using **Markdown**..."
            />
          ) : (
            <div className="border border-gray-200 rounded-lg px-4 py-3 bg-gray-50 min-h-[9rem] overflow-auto text-sm">
              {description.trim() ? (
                <MarkdownRenderer content={description} />
              ) : (
                <p className="text-gray-300 italic">Nothing to preview</p>
              )}
            </div>
          )}
        </div>

        {/* Date & time */}
        <div>
          <label className="block text-sm font-medium mb-1">Date & time</label>
          <input
            type="datetime-local"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* Map + Nearby reports side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">
              Meeting point (drag the blue pin)
            </label>
            <MeetingPointPicker
              meetingPoint={meetingPoint}
              onMeetingPointChange={setMeetingPoint}
              reports={nearbyReports}
              selectedReportIds={selectedReportIds}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Nearby reports ({nearbyReports.length})
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Select reports to link to this event. Selected pins turn yellow on the map.
            </p>
            <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto divide-y divide-gray-100">
              {nearbyReports.length === 0 ? (
                <p className="text-gray-400 text-sm p-3">No reports nearby.</p>
              ) : (
                nearbyReports.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition ${
                      selectedReportIds.has(r.id) ? 'bg-yellow-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedReportIds.has(r.id)}
                      onChange={() => toggleReport(r.id)}
                      className="rounded"
                    />
                    {r.images && r.images.length > 0 ? (
                      <img
                        src={thumbnailUrl(r.images[0])}
                        alt=""
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center text-sm flex-shrink-0">
                        📷
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{r.description || `Report #${r.id}`}</p>
                      {r.what3words && <p className="text-xs text-gray-400">///{r.what3words}</p>}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !title.trim() || !date}
          className="w-full bg-brand text-white py-2 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Update Event'}
        </button>
      </form>
    </div>
  )
}
