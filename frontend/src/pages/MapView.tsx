import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet.heat'
import { useState, useEffect, useRef, useCallback } from 'react'
import PageMeta from '../components/PageMeta'
import { getReports } from '../api/endpoints/reports/reports'
import { getVolunteers } from '../api/endpoints/volunteers/volunteers'
import { useAuth } from '../context/AuthContext'
import ReportPopup from '../components/ReportPopup'
import LocateButton from '../components/LocateButton'
import BinsLayer from '../components/BinsLayer'
import BinFormModal from '../components/BinFormModal'
import { binIcon } from '../components/BinMarker'
import { getBins } from '../api/endpoints/bins/bins'
import type { ReportRead, BinRead } from '../api/model'

const { listReportsApiReportsGet } = getReports()
const { listFavouritesApiVolunteersFavouritesGet } = getVolunteers()
const { createBinApiBinsPost, deleteBinApiBinsBinIdDelete } = getBins()

const BIN_ZOOM_THRESHOLD = 16

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
const staleIcon = createPinIcon('#f59e0b')

type Filter = 'all' | 'unresolved' | 'resolved' | 'stale' | 'favourites'
type TypeFilter = 'all' | 'litter' | 'gas_canister'

const FILTERS: { key: Filter; label: string; auth?: boolean }[] = [
  { key: 'all', label: 'All' },
  { key: 'unresolved', label: 'Unresolved' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'stale', label: 'Stale' },
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

  const icon = report.status === 'cleaned' ? cleanedIcon : report.is_stale ? staleIcon : pendingIcon

  return (
    <Marker
      position={[report.latitude, report.longitude]}
      icon={icon}
      eventHandlers={{ click: handleClick }}
    >
      <ReportPopup report={report} />
    </Marker>
  )
}

function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap()
  useEffect(() => {
    onZoom(map.getZoom())
  }, [map, onZoom])
  useMapEvents({
    zoomend: (e) => onZoom(e.target.getZoom()),
  })
  return null
}

const LONG_PRESS_MS = 500
const TOUCH_MOVE_TOLERANCE_PX = 15

function LongPressHandler({ onLongPress }: { onLongPress: (latlng: L.LatLng) => void }) {
  const map = useMap()
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let firedForGesture = false
    let touchStart: { x: number; y: number } | null = null

    const cancelTimer = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }

    const fire = (latlng: L.LatLng) => {
      if (firedForGesture) return
      firedForGesture = true
      onLongPress(latlng)
    }

    const startGesture = () => {
      cancelTimer()
      firedForGesture = false
    }

    const isInteractiveTarget = (target: Element | null) =>
      !!target &&
      !!(
        target.closest('.leaflet-marker-icon') ||
        target.closest('.leaflet-popup') ||
        target.closest('.leaflet-control')
      )

    const onMouseDown = (e: L.LeafletMouseEvent) => {
      startGesture()
      const target = e.originalEvent?.target as Element | null
      if (isInteractiveTarget(target)) return
      const { latlng } = e
      timer = setTimeout(() => {
        timer = null
        fire(latlng)
      }, LONG_PRESS_MS)
    }

    // Right-click on desktop, and Leaflet's TapHold on mobile Safari, both
    // emit `contextmenu`. Fire immediately and suppress the native menu.
    const onContextMenu = (e: L.LeafletMouseEvent) => {
      cancelTimer()
      const target = e.originalEvent?.target as Element | null
      if (isInteractiveTarget(target)) return
      fire(e.latlng)
      L.DomEvent.preventDefault(e.originalEvent)
    }

    map.on('mousedown', onMouseDown)
    map.on('mouseup', cancelTimer)
    map.on('dragstart', cancelTimer)
    map.on('movestart', cancelTimer)
    map.on('zoomstart', cancelTimer)
    map.on('contextmenu', onContextMenu)

    // Touch path: on most touch browsers Leaflet's synthetic `mousedown`
    // doesn't arrive until touchend, so we run our own timer off touchstart.
    const container = map.getContainer()

    const onTouchStart = (ev: TouchEvent) => {
      startGesture()
      if (ev.touches.length !== 1) return
      const target = ev.target as Element | null
      if (isInteractiveTarget(target)) return
      const touch = ev.touches[0]
      touchStart = { x: touch.clientX, y: touch.clientY }
      const latlng = map.mouseEventToLatLng({
        clientX: touch.clientX,
        clientY: touch.clientY,
      } as unknown as MouseEvent)
      timer = setTimeout(() => {
        timer = null
        fire(latlng)
      }, LONG_PRESS_MS)
    }

    const onTouchMove = (ev: TouchEvent) => {
      if (!timer || !touchStart || ev.touches.length === 0) return
      const touch = ev.touches[0]
      const dx = touch.clientX - touchStart.x
      const dy = touch.clientY - touchStart.y
      if (dx * dx + dy * dy > TOUCH_MOVE_TOLERANCE_PX * TOUCH_MOVE_TOLERANCE_PX) {
        cancelTimer()
      }
    }

    const onTouchEnd = () => {
      cancelTimer()
      touchStart = null
    }

    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', onTouchMove, { passive: true })
    container.addEventListener('touchend', onTouchEnd)
    container.addEventListener('touchcancel', onTouchEnd)

    return () => {
      cancelTimer()
      map.off('mousedown', onMouseDown)
      map.off('mouseup', cancelTimer)
      map.off('dragstart', cancelTimer)
      map.off('movestart', cancelTimer)
      map.off('zoomstart', cancelTimer)
      map.off('contextmenu', onContextMenu)
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      container.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [map, onLongPress])
  return null
}

function PendingBinMarker({
  position,
  onSubmit,
  onDismiss,
}: {
  position: { lat: number; lng: number }
  onSubmit: (description: string) => Promise<void>
  onDismiss: () => void
}) {
  const markerRef = useRef<L.Marker>(null)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    markerRef.current?.openPopup()
  }, [position])

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSubmit(description)
    } catch (err) {
      const message =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null
      setError(message || 'Failed to add bin')
      setSaving(false)
    }
  }

  return (
    <Marker
      ref={markerRef}
      position={[position.lat, position.lng]}
      icon={binIcon}
      zIndexOffset={1000}
    >
      <Popup autoClose={false} closeOnClick={false} closeButton={false}>
        <div style={{ minWidth: '220px' }}>
          <strong style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>
            🗑️ Add a bin here?
          </strong>
          <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#6b7280' }}>
            Tap the map to fine-tune the spot.
          </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Description (optional) e.g. Next to the bus stop"
            disabled={saving}
            style={{
              width: '100%',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '6px 8px',
              fontSize: '12px',
              color: '#374151',
              resize: 'vertical',
              marginBottom: '8px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          {error && (
            <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#dc2626' }}>{error}</p>
          )}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{
                flex: 1,
                padding: '6px',
                backgroundColor: '#0ea5e9',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Adding…' : 'Add bin'}
            </button>
            <button
              onClick={onDismiss}
              disabled={saving}
              style={{
                padding: '6px 10px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                opacity: saving ? 0.6 : 1,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

function PendingBinClickMover({ onClick }: { onClick: (latlng: L.LatLng) => void }) {
  useMapEvents({
    click: (e) => onClick(e.latlng),
  })
  return null
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
  const [showBins, setShowBins] = useState(true)
  const [mapZoom, setMapZoom] = useState(6)
  const [binsRefreshKey, setBinsRefreshKey] = useState(0)
  const [editingBin, setEditingBin] = useState<BinRead | null>(null)
  const [pendingBin, setPendingBin] = useState<{ lat: number; lng: number } | null>(null)
  const [openPanel, setOpenPanel] = useState<'status' | 'type' | 'layer' | null>(null)
  const togglePanel = (p: 'status' | 'type' | 'layer') =>
    setOpenPanel((prev) => (prev === p ? null : p))

  const handleBinDelete = async (bin: BinRead) => {
    if (!window.confirm('Delete this bin?')) return
    try {
      await deleteBinApiBinsBinIdDelete(bin.id)
      setBinsRefreshKey((k) => k + 1)
    } catch {
      alert('Failed to delete bin')
    }
  }

  const handleLongPress = useCallback(
    (latlng: L.LatLng) => {
      if (!isLoggedIn) return
      setShowBins(true)
      setPendingBin({ lat: latlng.lat, lng: latlng.lng })
    },
    [isLoggedIn]
  )

  const handleMovePendingBin = useCallback((latlng: L.LatLng) => {
    setPendingBin({ lat: latlng.lat, lng: latlng.lng })
  }, [])

  const handleCreateBin = async (description: string) => {
    if (!pendingBin) return
    await createBinApiBinsPost({
      latitude: pendingBin.lat,
      longitude: pendingBin.lng,
      description,
    })
    setPendingBin(null)
    setBinsRefreshKey((k) => k + 1)
  }

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
    if (filter === 'stale' && !r.is_stale) return false
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

        {/* Bins toggle */}
        <div className="flex flex-col items-end md:flex-row md:items-center gap-2 md:justify-end">
          <button
            onClick={() => setShowBins((v) => !v)}
            className={`w-10 h-10 flex items-center justify-center rounded-lg shadow-lg transition ${
              showBins ? 'bg-brand text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
            title={showBins ? 'Hide bins (shown when zoomed in)' : 'Show bins (zoom in to see)'}
          >
            <span className="text-lg leading-none">🗑️</span>
          </button>
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
        {showBins && (
          <BinsLayer
            refreshKey={binsRefreshKey}
            onEdit={(bin) => setEditingBin(bin)}
            onDelete={handleBinDelete}
          />
        )}
        <LocateButton />
        <ZoomTracker onZoom={setMapZoom} />
        {isLoggedIn && <LongPressHandler onLongPress={handleLongPress} />}
        {pendingBin && (
          <>
            <PendingBinClickMover onClick={handleMovePendingBin} />
            <PendingBinMarker
              position={pendingBin}
              onSubmit={handleCreateBin}
              onDismiss={() => setPendingBin(null)}
            />
          </>
        )}
      </MapContainer>

      {showBins && mapZoom < BIN_ZOOM_THRESHOLD && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 text-gray-600 text-xs px-3 py-1 rounded-full shadow">
          Zoom in to see bins
        </div>
      )}

      {editingBin && (
        <BinFormModal
          initialPosition={null}
          existing={editingBin}
          onClose={() => setEditingBin(null)}
          onSaved={() => {
            setEditingBin(null)
            setBinsRefreshKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}
