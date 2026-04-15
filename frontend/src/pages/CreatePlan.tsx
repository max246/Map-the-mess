import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import PageMeta from '../components/PageMeta'
import LocateButton from '../components/LocateButton'
import { getPlanner } from '../api/endpoints/planner/planner'
import { getReports } from '../api/endpoints/reports/reports'
import { useAuth } from '../context/AuthContext'
import type { ReportRead } from '../api/model'

const { createPlanApiPlannerPost } = getPlanner()
const { listReportsApiReportsGet } = getReports()

const UK_CENTER: [number, number] = [53.5, -1.5]
const MAX_REPORTS = 10

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

const pendingIcon = createPinIcon('#ef4444')

const startIcon = L.icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#16a34a" stroke="#fff" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="#fff"/>
  </svg>`)}`,
  iconSize: [28, 42],
  iconAnchor: [14, 42],
  popupAnchor: [0, -42],
})

function StartPointPicker({
  position,
  onSet,
}: {
  position: [number, number] | null
  onSet: (pos: [number, number]) => void
}) {
  useMapEvents({
    click(e) {
      onSet([e.latlng.lat, e.latlng.lng])
    },
  })
  if (!position) return null
  return <Marker position={position} icon={startIcon} />
}

function FlyToLocation({ position }: { position: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(position, 14, { duration: 0.8 })
  }, [map, position])
  return null
}

export default function CreatePlan() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [reports, setReports] = useState<ReportRead[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null)
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listReportsApiReportsGet({ status: 'pending' })
      .then(setReports)
      .catch(() => setReports([]))
  }, [])

  const toggleReport = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < MAX_REPORTS) {
        next.add(id)
      }
      return next
    })
  }

  const handleLocate = (pos: { lat: number; lng: number }) => {
    setStartPoint([pos.lat, pos.lng])
  }

  const handleCreate = async () => {
    if (!startPoint) {
      setError('Please set a start point by clicking the map or using the locate button.')
      return
    }
    if (selected.size === 0) {
      setError('Please select at least one report.')
      return
    }
    setCreating(true)
    setError('')
    try {
      const plan = await createPlanApiPlannerPost({
        report_ids: Array.from(selected),
        start_latitude: startPoint[0],
        start_longitude: startPoint[1],
        name: name.trim() || undefined,
      })
      navigate(`/planner/${plan.id}`)
    } catch {
      setError('Failed to create plan. Please try again.')
      setCreating(false)
    }
  }

  if (!isLoggedIn) return <Navigate to="/login" replace />

  const selectionOrder = Array.from(selected)

  return (
    <div className="h-full flex flex-col">
      <PageMeta
        title="Create Plan"
        description="Select litter reports on the map to create a walking cleanup route."
      />
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          <h1 className="text-lg font-bold whitespace-nowrap">Create Plan</h1>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Plan name (optional)"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[150px] max-w-xs"
          />
          <span className="text-sm text-gray-500 whitespace-nowrap">
            {selected.size}/{MAX_REPORTS} selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/planner')}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || selected.size === 0 || !startPoint}
            className="px-4 py-1.5 bg-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Plan'}
          </button>
        </div>
      </div>
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {!startPoint && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-700">
          Click the map to set your starting point, or use the locate button.
        </div>
      )}
      <div className="flex-1 relative">
        <MapContainer center={UK_CENTER} zoom={6} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <StartPointPicker position={startPoint} onSet={setStartPoint} />
          <LocateButton onLocate={handleLocate} />
          {flyTo && <FlyToLocation position={flyTo} />}
          {reports.map((r) => {
            const idx = selectionOrder.indexOf(r.id)
            const isSelected = idx !== -1
            return (
              <Marker
                key={r.id}
                position={[r.latitude, r.longitude]}
                icon={isSelected ? createNumberedIcon(idx + 1) : pendingIcon}
                eventHandlers={{ click: () => toggleReport(r.id) }}
              />
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
