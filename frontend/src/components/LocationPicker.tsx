import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { useRef, useMemo, useEffect } from 'react'
import L from 'leaflet'
import LocateButton from './LocateButton'

interface Position {
  lat: number
  lng: number
}

interface LocationPickerProps {
  position: Position | null
  onMove: (pos: Position) => void
}

const DEFAULT_CENTER: [number, number] = [53.5, -1.5]
const DEFAULT_ZOOM = 6
const LOCATED_ZOOM = 16

function MapClickHandler({ onMove }: { onMove: (pos: Position) => void }) {
  useMapEvents({
    click(e) {
      onMove({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function FlyToPosition({ position }: { position: Position }) {
  const map = useMap()
  const hasFlewRef = useRef(false)

  useEffect(() => {
    if (!hasFlewRef.current) {
      map.flyTo([position.lat, position.lng], LOCATED_ZOOM, { duration: 0.8 })
      hasFlewRef.current = true
    }
  }, [map, position.lat, position.lng])

  return null
}

function DraggableMarker({
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

  return (
    <Marker
      draggable
      position={[position.lat, position.lng]}
      ref={markerRef}
      eventHandlers={eventHandlers}
    />
  )
}

export default function LocationPicker({ position, onMove }: LocationPickerProps) {
  return (
    <div className="h-64 rounded-lg overflow-hidden border relative">
      <MapContainer
        center={position ? [position.lat, position.lng] : DEFAULT_CENTER}
        zoom={position ? LOCATED_ZOOM : DEFAULT_ZOOM}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onMove={onMove} />
        {position && <DraggableMarker position={position} onMove={onMove} />}
        {position && <FlyToPosition position={position} />}
        <LocateButton onLocate={onMove} showMarker={false} />
      </MapContainer>
    </div>
  )
}
