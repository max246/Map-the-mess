import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import PageMeta from '../components/PageMeta'
import { getCommunities } from '../api/endpoints/communities/communities'
import { getReports } from '../api/endpoints/reports/reports'
import { useAuth } from '../context/AuthContext'
import { thumbnailUrl } from '../api/client'
import LocateButton from '../components/LocateButton'
import MarkdownRenderer from '../components/MarkdownRenderer'
import SaveToCalendarButton from '../components/SaveToCalendarButton'
import ShareButton from '../components/ShareButton'
import type { EventRead, ReportRead } from '../api/model'

const {
  getEventApiCommunitiesCommunityIdEventsEventIdGet,
  getCommunityApiCommunitiesCommunityIdGet,
  deleteEventApiCommunitiesCommunityIdEventsEventIdDelete,
  attendEventApiCommunitiesCommunityIdEventsEventIdAttendPost,
  unattendEventApiCommunitiesCommunityIdEventsEventIdAttendDelete,
} = getCommunities()
const { listReportsApiReportsGet } = getReports()

function createPinIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="#fff"/>
  </svg>`
  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -42],
  })
}

const meetingIcon = createPinIcon('#3b82f6')
const reportIcon = createPinIcon('#ef4444')

function FitAllMarkers({
  meetingPoint,
  reports,
}: {
  meetingPoint: [number, number]
  reports: ReportRead[]
}) {
  const map = useMap()
  useEffect(() => {
    const points: [number, number][] = [
      meetingPoint,
      ...reports.map((r) => [r.latitude, r.longitude] as [number, number]),
    ]
    if (points.length > 1) {
      map.fitBounds(
        points.map((p) => L.latLng(p[0], p[1])).map((ll) => [ll.lat, ll.lng] as [number, number]),
        {
          padding: [40, 40],
          maxZoom: 16,
        }
      )
    }
  }, [map, meetingPoint, reports])
  return null
}

export default function EventDetail() {
  const { id: communityId, eventId } = useParams<{ id: string; eventId: string }>() as {
    id: string
    eventId: string
  }
  const { user } = useAuth()
  const navigate = useNavigate()

  const [event, setEvent] = useState<EventRead | null>(null)
  const [reports, setReports] = useState<ReportRead[]>([])
  const [communityName, setCommunityName] = useState('')
  const [isOwner, setIsOwner] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attending, setAttending] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [e, community, myCommunities] = await Promise.all([
          getEventApiCommunitiesCommunityIdEventsEventIdGet(communityId, eventId!),
          getCommunityApiCommunitiesCommunityIdGet(communityId),
          user ? getCommunities().myCommunitiesApiCommunitiesMineGet() : Promise.resolve(null),
        ])
        setEvent(e)
        setCommunityName(community.name)
        setIsOwner(!!(user && community.owner_id === user.id))
        if (myCommunities) {
          const joinedIds = new Set((myCommunities.joined || []).map((c) => c.id))
          setIsMember(joinedIds.has(communityId) || community.owner_id === user?.id)
        }

        if (e.report_ids && e.report_ids.length > 0) {
          const all = await listReportsApiReportsGet()
          setReports(all.filter((r) => e.report_ids?.includes(r.id)))
        }
      } catch {
        setError('Event not found')
      }
      setLoading(false)
    }
    fetchData()
  }, [communityId, eventId, user])

  const handleDelete = async () => {
    if (!confirm('Delete this event? This cannot be undone.')) return
    try {
      await deleteEventApiCommunitiesCommunityIdEventsEventIdDelete(communityId, eventId!)
      navigate(`/communities/${communityId}`)
    } catch {
      alert('Failed to delete event')
    }
  }

  const handleToggleAttend = async () => {
    if (!event) return
    setAttending(true)
    try {
      let updated: EventRead
      if (event.is_attending) {
        updated = await unattendEventApiCommunitiesCommunityIdEventsEventIdAttendDelete(
          communityId,
          eventId!
        )
      } else {
        updated = await attendEventApiCommunitiesCommunityIdEventsEventIdAttendPost(
          communityId,
          eventId!
        )
      }
      setEvent(updated)
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || 'Failed to update attendance')
    }
    setAttending(false)
  }

  if (loading) return <div className="text-center text-gray-400 py-16">Loading...</div>
  if (error || !event)
    return <div className="text-center text-gray-500 py-16">{error || 'Not found'}</div>

  const date = new Date(event.date)
  const isPast = date < new Date()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <PageMeta title="Event" description="View cleanup event details, location, and attendees." />
      <Link
        to={`/communities/${communityId}`}
        className="text-sm text-brand underline mb-4 inline-block"
      >
        ← Back to community
      </Link>

      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{event.title}</h1>
          {isPast && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Past</span>
          )}
          <ShareButton title={event.title} />
          {!isPast && <SaveToCalendarButton event={event} communityName={communityName} />}
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <Link
              to={`/communities/${communityId}/events/${eventId!}/edit`}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
            >
              Edit
            </Link>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-red-300 text-red-700 hover:bg-red-50 transition"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-5 mb-6">
        {event.description && (
          <div className="mb-4">
            <MarkdownRenderer content={event.description} />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Date</span>
            <p className="font-medium">
              {date.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Time</span>
            <p className="font-medium">
              {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Meeting point</span>
            <p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${event.meeting_latitude},${event.meeting_longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline"
              >
                {event.meeting_latitude.toFixed(5)}, {event.meeting_longitude.toFixed(5)}
              </a>
            </p>
          </div>
          <div>
            <span className="text-gray-500">Reports linked</span>
            <p className="font-medium">{reports.length}</p>
          </div>
        </div>

        {/* Attendance */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">{event.attendee_count ?? 0}</span>{' '}
            {event.attendee_count === 1 ? 'person' : 'people'} attending
          </p>
          {user && isMember && !isPast && (
            <button
              onClick={handleToggleAttend}
              disabled={attending}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                event.is_attending
                  ? 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                  : 'bg-brand text-white hover:opacity-90'
              }`}
            >
              {attending ? 'Updating...' : event.is_attending ? 'Leave event' : 'Attend'}
            </button>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="rounded-lg overflow-hidden shadow h-80 relative mb-6">
        <MapContainer
          center={[event.meeting_latitude, event.meeting_longitude]}
          zoom={15}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[event.meeting_latitude, event.meeting_longitude]} icon={meetingIcon}>
            <Popup>
              <strong style={{ fontSize: '14px' }}>📍 Meeting Point</strong>
            </Popup>
          </Marker>
          {reports.map((r) => {
            const image = r.images?.filter((i) => i.image_type === 'report')[0] || r.images?.[0]
            return (
              <Marker key={r.id} position={[r.latitude, r.longitude]} icon={reportIcon}>
                <Popup>
                  <div style={{ minWidth: '180px' }}>
                    {image ? (
                      <img
                        src={thumbnailUrl(image)}
                        alt="Report"
                        style={{
                          width: '100%',
                          height: '100px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          marginBottom: '6px',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100px',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '4px',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#9ca3af',
                          fontSize: '20px',
                        }}
                      >
                        📷
                      </div>
                    )}
                    <strong style={{ fontSize: '13px' }}>
                      🔴 {r.description || 'No description'}
                    </strong>
                    {r.address && (
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#6b7280' }}>
                        {r.address}
                      </p>
                    )}
                    {r.what3words && (
                      <p
                        style={{
                          margin: '3px 0 0',
                          fontSize: '11px',
                          color: '#e11d48',
                          fontWeight: 500,
                        }}
                      >
                        /// {r.what3words}
                      </p>
                    )}
                    <button
                      onClick={() => navigate(`/report/${r.id}`)}
                      style={{
                        width: '100%',
                        marginTop: '8px',
                        padding: '5px',
                        backgroundColor: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      Open Report
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}
          <FitAllMarkers
            meetingPoint={[event.meeting_latitude, event.meeting_longitude]}
            reports={reports}
          />
          <LocateButton showMarker />
        </MapContainer>
      </div>

      {/* Linked reports list */}
      {reports.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3">Planned Reports</h2>
          <div className="space-y-2">
            {reports.map((r) => (
              <Link
                key={r.id}
                to={`/report/${r.id}`}
                className="block bg-white rounded-lg shadow p-3 hover:shadow-md transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🔴</span>
                  <span className="text-sm font-medium">
                    {r.description || `Report #${r.id.slice(-6)}`}
                  </span>
                  {r.what3words && <span className="text-xs text-brand">/// {r.what3words}</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> Meeting point
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500" /> Report
        </span>
      </div>
    </div>
  )
}
