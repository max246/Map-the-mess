import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { useRef, useMemo } from 'react'
import L from 'leaflet'
import LocateButton from './LocateButton'
import type { ReportRead } from '../api/model'

interface Position {
  lat: number
  lng: number
}

interface MeetingPointPickerProps {
  meetingPoint: Position
  onMeetingPointChange: (pos: Position) => void
  reports: ReportRead[]
  selectedReportIds: Set<string>
}

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
const selectedIcon = createPinIcon('#eab308')

function DraggableMeetingPoint({
  position,
  onMove,
}: {
  position: Position
  onMove: (pos: Position) => void
}) {
  const markerRef = useRef<L.Marker>(null)

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current
        if (marker) {
          const { lat, lng } = marker.getLatLng()
          onMove({ lat, lng })
        }
      },
    }),
    [onMove]
  )

  useMapEvents({
    click(e) {
      onMove({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })

  return (
    <Marker
      draggable
      position={[position.lat, position.lng]}
      ref={markerRef}
      eventHandlers={eventHandlers}
      icon={meetingIcon}
    />
  )
}

export default function MeetingPointPicker({
  meetingPoint,
  onMeetingPointChange,
  reports,
  selectedReportIds,
}: MeetingPointPickerProps) {
  return (
    <div className="h-96 rounded-lg overflow-hidden border relative">
      <MapContainer
        center={[meetingPoint.lat, meetingPoint.lng]}
        zoom={14}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DraggableMeetingPoint position={meetingPoint} onMove={onMeetingPointChange} />
        {reports.map((r) => (
          <Marker
            key={r.id}
            position={[r.latitude, r.longitude]}
            icon={selectedReportIds.has(r.id) ? selectedIcon : reportIcon}
          />
        ))}
        <LocateButton showMarker />
      </MapContainer>
    </div>
  )
}
