import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import PageMeta from '../components/PageMeta'
import { getPlanner } from '../api/endpoints/planner/planner'
import { useAuth } from '../context/AuthContext'
import { thumbnailUrl, API_BASE_URL } from '../api/client'
import type { PlanRead } from '../api/model'

const {
  getPlanApiPlannerPlanIdGet,
  updatePlanApiPlannerPlanIdPatch,
  startPlanApiPlannerPlanIdStartPatch,
  completePlanApiPlannerPlanIdCompletePatch,
  deletePlanApiPlannerPlanIdDelete,
} = getPlanner()

function createNumberedIcon(n: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#2563eb" stroke="#fff" stroke-width="1.5"/>
    <text x="12" y="16" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="sans-serif">${n}</text>
  </svg>`
  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -42],
  })
}

const startIcon = L.icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#16a34a" stroke="#fff" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="#fff"/>
  </svg>`)}`,
  iconSize: [28, 42],
  iconAnchor: [14, 42],
  popupAnchor: [0, -42],
})

function statusBadge(status: string) {
  switch (status) {
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-700'
    case 'completed':
      return 'bg-green-100 text-green-700'
    default:
      return 'bg-blue-100 text-blue-700'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'in_progress':
      return 'In Progress'
    case 'completed':
      return 'Completed'
    default:
      return 'Planned'
  }
}

function formatDistance(meters: number | null | undefined) {
  if (meters == null) return '-'
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return '-'
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
}

function FitBounds({ plan }: { plan: PlanRead }) {
  const map = useMap()
  useEffect(() => {
    const points: [number, number][] = [[plan.start_latitude, plan.start_longitude]]
    plan.plan_reports?.forEach((pr) => {
      points.push([pr.report.latitude, pr.report.longitude])
    })
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])))
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [map, plan])
  return null
}

export default function PlanDetail() {
  const { isLoggedIn } = useAuth()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<PlanRead | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameLoading, setNameLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    getPlanApiPlannerPlanIdGet(id)
      .then(setPlan)
      .catch(() => setPlan(null))
      .finally(() => setLoading(false))
  }, [id])

  const handleStart = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      const updated = await startPlanApiPlannerPlanIdStartPatch(id)
      setPlan(updated)
    } catch {
      alert('Failed to start plan.')
    }
    setActionLoading(false)
  }

  const handleComplete = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      const updated = await completePlanApiPlannerPlanIdCompletePatch(id)
      setPlan(updated)
    } catch {
      alert('Failed to complete plan.')
    }
    setActionLoading(false)
  }

  const handleDelete = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await deletePlanApiPlannerPlanIdDelete(id)
      navigate('/planner')
    } catch {
      alert('Failed to delete plan.')
      setActionLoading(false)
    }
  }

  const handleSaveName = async () => {
    if (!id) return
    setNameLoading(true)
    try {
      const updated = await updatePlanApiPlannerPlanIdPatch(id, { name: nameInput.trim() || null })
      setPlan(updated)
      setEditingName(false)
    } catch {
      alert('Failed to update name.')
    }
    setNameLoading(false)
  }

  const handleExportGpx = () => {
    if (!id) return
    const token = localStorage.getItem('token')
    const url = `${API_BASE_URL}/api/planner/${id}/export.gpx`
    const a = document.createElement('a')
    a.href = url
    a.download = `plan-${id}.gpx`
    // Use fetch with auth header then trigger download
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob)
        a.href = blobUrl
        a.click()
        URL.revokeObjectURL(blobUrl)
      })
      .catch(() => alert('Failed to export GPX.'))
  }

  if (!isLoggedIn) return <Navigate to="/login" replace />

  if (loading) {
    return <p className="text-center text-gray-400 py-20">Loading...</p>
  }

  if (!plan) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-400 text-lg mb-4">Plan not found.</p>
        <Link to="/planner" className="text-brand hover:underline">
          Back to plans
        </Link>
      </div>
    )
  }

  const sortedReports = [...(plan.plan_reports || [])].sort((a, b) => a.visit_order - b.visit_order)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageMeta
        title={plan.name || 'Plan Detail'}
        description="View your walking cleanup route with optimised directions."
      />
      <Link to="/planner" className="text-sm text-brand hover:underline mb-4 inline-block">
        &larr; Back to plans
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-lg font-bold flex-1 min-w-[150px]"
                placeholder="Plan name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName()
                  if (e.key === 'Escape') setEditingName(false)
                }}
              />
              <button
                onClick={handleSaveName}
                disabled={nameLoading}
                className="px-3 py-1.5 bg-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {nameLoading ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{plan.name || 'Untitled plan'}</h1>
              <button
                onClick={() => {
                  setNameInput(plan.name || '')
                  setEditingName(true)
                }}
                className="text-xs text-brand hover:underline"
              >
                Edit
              </button>
            </div>
          )}
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(plan.status)}`}
            >
              {statusLabel(plan.status)}
            </span>
            <span>{formatDistance(plan.total_distance_meters)}</span>
            <span>{formatDuration(plan.total_duration_seconds)}</span>
            <span>
              {new Date(plan.created_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {plan.status === 'planned' && (
          <button
            onClick={handleStart}
            disabled={actionLoading}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            Start Plan
          </button>
        )}
        {plan.status === 'in_progress' && (
          <button
            onClick={handleComplete}
            disabled={actionLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
          >
            Complete Plan
          </button>
        )}
        {plan.google_maps_url && (
          <a
            href={plan.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Open in Google Maps
          </a>
        )}
        <button
          onClick={handleExportGpx}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          Export GPX
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="px-4 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 hover:bg-red-50 transition"
        >
          Delete
        </button>
      </div>

      {/* Map */}
      <div className="rounded-lg overflow-hidden shadow mb-6" style={{ height: 400 }}>
        <MapContainer
          center={[plan.start_latitude, plan.start_longitude]}
          zoom={13}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds plan={plan} />
          <Marker position={[plan.start_latitude, plan.start_longitude]} icon={startIcon} />
          {sortedReports.map((pr) => (
            <Marker
              key={pr.id}
              position={[pr.report.latitude, pr.report.longitude]}
              icon={createNumberedIcon(pr.visit_order)}
            />
          ))}
          {plan.route_geometry && (
            <GeoJSON
              data={plan.route_geometry as unknown as GeoJSON.GeoJsonObject}
              style={{ color: '#2563eb', weight: 4, opacity: 0.7 }}
            />
          )}
        </MapContainer>
      </div>

      {/* Report list */}
      <h2 className="text-lg font-semibold mb-3">Stops ({sortedReports.length})</h2>
      <div className="flex flex-col gap-3">
        {sortedReports.map((pr) => {
          const firstImage = pr.report.images?.find((img) => img.image_type === 'report')
          return (
            <div key={pr.id} className="bg-white rounded-lg shadow flex overflow-hidden">
              <div className="w-10 flex-shrink-0 bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                {pr.visit_order}
              </div>
              <Link to={`/report/${pr.report.id}`} className="flex flex-1 min-w-0">
                <div className="w-20 h-20 flex-shrink-0 bg-gray-100">
                  {firstImage ? (
                    <img
                      src={thumbnailUrl(firstImage)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">
                      📷
                    </div>
                  )}
                </div>
                <div className="flex-1 p-3 min-w-0">
                  <p className="text-sm text-gray-700 truncate">
                    {pr.report.description || 'No description'}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {pr.leg_distance_meters != null && (
                      <span>{formatDistance(pr.leg_distance_meters)} walk</span>
                    )}
                    {pr.leg_duration_seconds != null && (
                      <span>{formatDuration(pr.leg_duration_seconds)}</span>
                    )}
                    {pr.report.what3words && (
                      <span className="text-brand">/// {pr.report.what3words}</span>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          )
        })}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete this plan?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This action cannot be undone. The plan and its route will be permanently deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={actionLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
