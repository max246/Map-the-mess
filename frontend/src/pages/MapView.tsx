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
type TypeFilter = 'all' | 'litter' | 'gas_canister'

const FILTERS: { key: Filter; label: string; auth?: boolean }[] = [
  { key: 'all', label: 'All' },
  { key: 'unresolved', label: 'Unresolved' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'favourites', label: 'Favourites', auth: true },
]

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All Types' },
  { key: 'litter', label: 'Litter' },
  { key: 'gas_canister', label: 'Gas Canister' },
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
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [layer, setLayer] = useState<'pins' | 'heatmap'>('pins')
  const [openPanel, setOpenPanel] = useState<'status' | 'type' | 'layer' | null>(null)
  const togglePanel = (p: 'status' | 'type' | 'layer') =>
    setOpenPanel((prev) => (prev === p ? null : p))

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
    if (filter === 'unresolved' && r.status === 'cleaned') return false
    if (filter === 'resolved' && r.status !== 'cleaned') return false
    if (filter === 'favourites' && !favouriteIds.has(r.id)) return false
    if (typeFilter !== 'all' && r.report_type !== typeFilter) return false
    return true
  })

  const visibleFilters = FILTERS.filter((f) => !f.auth || isLoggedIn)

  return (
    <div className="h-full relative">
      <PageMeta
        title="Litter Map"
        description="View reported litter on an interactive map of Britain. Find nearby reports and help clean up your area."
      />
      {/* Filter icon stack — top right */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        {/* Status filter */}
        <div className="flex flex-col items-end md:flex-row md:items-center gap-2 md:justify-end">
          <button
            onClick={() => togglePanel('status')}
            className={`w-10 h-10 flex items-center justify-center rounded-lg shadow-lg transition order-first md:order-last ${
              openPanel === 'status' || filter !== 'unresolved'
                ? 'bg-brand text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
            title="Status filter"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          {openPanel === 'status' && (
            <div className="flex flex-col md:flex-row gap-1 bg-white rounded-lg shadow-lg p-1">
              {visibleFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
                    filter === f.key ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Type filter */}
        <div className="flex flex-col items-end md:flex-row md:items-center gap-2 md:justify-end">
          <button
            onClick={() => togglePanel('type')}
            className={`w-10 h-10 flex items-center justify-center rounded-lg shadow-lg transition order-first md:order-last ${
              openPanel === 'type' || typeFilter !== 'all'
                ? 'bg-brand text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
            title="Type filter"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M5.5 3A2.5 2.5 0 003 5.5v2.879a2.5 2.5 0 00.732 1.767l6.5 6.5a2.5 2.5 0 003.536 0l2.878-2.878a2.5 2.5 0 000-3.536l-6.5-6.5A2.5 2.5 0 008.38 3H5.5zM6 7a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          {openPanel === 'type' && (
            <div className="flex flex-col md:flex-row gap-1 bg-white rounded-lg shadow-lg p-1">
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setTypeFilter(f.key)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
                    typeFilter === f.key ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Layer toggle */}
        <div className="flex flex-col items-end md:flex-row md:items-center gap-2 md:justify-end">
          <button
            onClick={() => togglePanel('layer')}
            className={`w-10 h-10 flex items-center justify-center rounded-lg shadow-lg transition order-first md:order-last ${
              openPanel === 'layer' || layer !== 'pins'
                ? 'bg-brand text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
            title="Layer toggle"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M10 1.588l-7.5 4.48L10 10.547l7.5-4.48L10 1.589z" />
              <path
                d="M2.5 10.588L10 15.068l7.5-4.48-1.5-.896L10 13.172l-5.5-3.48-2 1.196-.5-.3z"
                opacity="0.6"
              />
            </svg>
          </button>
          {openPanel === 'layer' && (
            <div className="flex flex-col md:flex-row gap-1 bg-white rounded-lg shadow-lg p-1">
              {(['pins', 'heatmap'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLayer(l)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
                    layer === l ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {l === 'pins' ? 'Pins' : 'Heatmap'}
                </button>
              ))}
            </div>
          )}
        </div>
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
