import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet.heat'
import { useState, useEffect } from 'react'
import PageMeta from '../components/PageMeta'
import { getReports } from '../api/endpoints/reports/reports'
import { getVolunteers } from '../api/endpoints/volunteers/volunteers'
import { useAuth } from '../context/AuthContext'
import ReportPopup from '../components/ReportPopup'
import LocateButton from '../components/LocateButton'
import type { ReportRead } from '../api/model'

const { listReportsApiReportsGet } = getReports()
const { listFavouritesApiVolunteersFavouritesGet } = getVolunteers()

// Default centre: somewhere in Britain
const UK_CENTER: [number, number] = [53.5, -1.5]
const MIN_ZOOM_ON_CLICK = 15

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

const pendingIcon = createPinIcon('#ef4444')
const cleanedIcon = createPinIcon('#22c55e')

type Filter = 'all' | 'unresolved' | 'resolved' | 'favourites'

const FILTERS: { key: Filter; label: string; auth?: boolean }[] = [
  { key: 'all', label: 'All' },
  { key: 'unresolved', label: 'Unresolved' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'favourites', label: 'Favourites', auth: true },
]

function ZoomMarker({ report }: { report: ReportRead }) {
  const map = useMap()

  const handleClick = () => {
    if (map.getZoom() < MIN_ZOOM_ON_CLICK) {
      map.flyTo([report.latitude, report.longitude], MIN_ZOOM_ON_CLICK)
    }
  }

  return (
    <Marker
      position={[report.latitude, report.longitude]}
      icon={report.status === 'cleaned' ? cleanedIcon : pendingIcon}
      eventHandlers={{ click: handleClick }}
    >
      <ReportPopup report={report} />
    </Marker>
  )
}

function HeatmapLayer({ reports }: { reports: ReportRead[] }) {
  const map = useMap()

  useEffect(() => {
    const points: [number, number][] = reports.map((r) => [r.latitude, r.longitude])
    const heat = L.heatLayer(points, { radius: 25, blur: 15, maxZoom: 13, minOpacity: 0.3 }).addTo(
      map
    )

    const onClick = (e: L.LeafletMouseEvent) => {
      map.flyTo(e.latlng, Math.min(map.getZoom() + 3, 18))
    }
    map.on('click', onClick)

    return () => {
      map.removeLayer(heat)
      map.off('click', onClick)
    }
  }, [map, reports])

  return null
}

export default function MapView() {
  const { isLoggedIn } = useAuth()
  const [allReports, setAllReports] = useState<ReportRead[]>([])
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<Filter>('unresolved')
  const [layer, setLayer] = useState<'pins' | 'heatmap'>('pins')

  useEffect(() => {
    listReportsApiReportsGet()
      .then((data) => setAllReports(data))
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!isLoggedIn) return
    listFavouritesApiVolunteersFavouritesGet()
      .then((data) => setFavouriteIds(new Set(data.map((r) => r.id))))
      .catch(() => {})
  }, [isLoggedIn])

  const filteredReports = allReports.filter((r) => {
    if (filter === 'unresolved') return r.status !== 'cleaned'
    if (filter === 'resolved') return r.status === 'cleaned'
    if (filter === 'favourites') return favouriteIds.has(r.id)
    return true
  })

  const visibleFilters = FILTERS.filter((f) => !f.auth || isLoggedIn)

  return (
    <div className="h-full relative">
      <PageMeta
        title="Litter Map"
        description="View reported litter on an interactive map of Britain. Find nearby reports and help clean up your area."
      />
      {/* Filter bar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex gap-1 bg-white rounded-lg shadow-lg p-1">
        {visibleFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              filter === f.key ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Layer toggle */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1000] flex gap-1 bg-white rounded-lg shadow-lg p-1">
        {(['pins', 'heatmap'] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLayer(l)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              layer === l ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {l === 'pins' ? 'Pins' : 'Heatmap'}
          </button>
        ))}
      </div>

      <MapContainer center={UK_CENTER} zoom={6} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {layer === 'pins' ? (
          <MarkerClusterGroup chunkedLoading>
            {filteredReports.map((r) => (
              <ZoomMarker key={r.id} report={r} />
            ))}
          </MarkerClusterGroup>
        ) : (
          <HeatmapLayer reports={filteredReports} />
        )}
        <LocateButton />
      </MapContainer>
    </div>
  )
}
