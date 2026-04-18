import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import { getCommunities } from '../api/endpoints/communities/communities'
import { getReports } from '../api/endpoints/reports/reports'
import { useAuth } from '../context/AuthContext'
import { thumbnailUrl } from '../api/client'
import MeetingPointPicker from '../components/MeetingPointPicker'
import MarkdownRenderer from '../components/MarkdownRenderer'
import DateTimePicker from '../components/DateTimePicker'
import type { CommunityRead, ReportRead } from '../api/model'

const { listCommunitiesApiCommunitiesGet, createEventApiCommunitiesCommunityIdEventsPost } =
  getCommunities()
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

export default function CreateEvent() {
  const { id: communityId } = useParams<{ id: string }>() as { id: string }
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()

  const [community, setCommunity] = useState<CommunityRead | null>(null)
  const [allReports, setAllReports] = useState<ReportRead[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [descriptionTab, setDescriptionTab] = useState<'write' | 'preview'>('write')
  const [date, setDate] = useState('')
  const [meetingPoint, setMeetingPoint] = useState({ lat: 53.5, lng: -1.5 })
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set())
  const [recurrenceRule, setRecurrenceRule] = useState('')
  const [recurrenceEnd, setRecurrenceEnd] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoggedIn) navigate('/login', { replace: true })
  }, [isLoggedIn, navigate])

  useEffect(() => {
    // Fetch community details (for location centre) and pending reports
    listCommunitiesApiCommunitiesGet({ search: '' })
      .then((communities) => {
        const c = communities.find((x) => x.id === communityId)
        if (c) {
          setCommunity(c)
          setMeetingPoint({ lat: c.latitude, lng: c.longitude })
        }
      })
      .catch(console.error)

    listReportsApiReportsGet({ status: 'pending' }).then(setAllReports).catch(console.error)
  }, [communityId])

  // Filter reports to those within the community's radius
  const nearbyReports = useMemo(() => {
    if (!community) return []
    return allReports.filter(
      (r) =>
        haversineKm(community.latitude, community.longitude, r.latitude, r.longitude) <=
        community.radius_km
    )
  }, [allReports, community])

  const toggleReport = (reportId: string) => {
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
      await createEventApiCommunitiesCommunityIdEventsPost(communityId, {
        title: title.trim(),
        description: description.trim() || undefined,
        date: new Date(date).toISOString(),
        meeting_latitude: meetingPoint.lat,
        meeting_longitude: meetingPoint.lng,
        report_ids: Array.from(selectedReportIds),
        recurrence_rule: recurrenceRule || undefined,
        recurrence_end: recurrenceEnd ? new Date(recurrenceEnd).toISOString() : undefined,
      })
      navigate(`/communities/${communityId}`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to create event'
      setError(msg)
      setSubmitting(false)
    }
  }

  if (!isLoggedIn) return null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageMeta title="New Event" description="Create a new cleanup event for your community." />
      <Link
        to={`/communities/${communityId}`}
        className="text-sm text-brand underline mb-4 inline-block"
      >
        ← Back to community
      </Link>

      <h1 className="text-2xl font-bold mb-6">New Event</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title + Date & time */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
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
          <div>
            <label className="block text-sm font-medium mb-1">Date & time</label>
            <DateTimePicker value={date} onChange={setDate} mode="datetime" />
          </div>
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

        {/* Recurrence */}
        <div>
          <label className="block text-sm font-medium mb-1">Repeats</label>
          <select
            value={recurrenceRule}
            onChange={(e) => setRecurrenceRule(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Does not repeat</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly (same weekday)</option>
          </select>
          {recurrenceRule && (
            <div className="mt-2">
              <label className="block text-xs text-gray-500 mb-1">
                End date (optional — leave empty for ongoing)
              </label>
              <DateTimePicker
                value={recurrenceEnd}
                onChange={setRecurrenceEnd}
                mode="date"
                placeholder="No end date"
              />
            </div>
          )}
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
                <p className="text-gray-400 text-sm p-3">
                  No unresolved reports within the community area.
                </p>
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
          {submitting ? 'Creating...' : 'Create Event'}
        </button>
      </form>
    </div>
  )
}
