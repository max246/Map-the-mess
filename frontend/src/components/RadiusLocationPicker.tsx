import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet'
import { useRef, useMemo, useEffect } from 'react'
import L from 'leaflet'
import LocateButton from './LocateButton'

interface Position {
  lat: number
  lng: number
}

interface RadiusLocationPickerProps {
  position: Position
  radiusKm: number
  onMove: (pos: Position) => void
  onRadiusChange: (km: number) => void
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
    />
  )
}

function FitCircle({ position, radiusKm }: { position: Position; radiusKm: number }) {
  const map = useMap()
  useEffect(() => {
    // ~111 km per degree of latitude
    const deltaLat = radiusKm / 111
    const deltaLng = radiusKm / (111 * Math.cos((position.lat * Math.PI) / 180))
    map.fitBounds(
      [
        [position.lat - deltaLat, position.lng - deltaLng],
        [position.lat + deltaLat, position.lng + deltaLng],
      ],
      { padding: [20, 20] }
    )
  }, [map, position.lat, position.lng, radiusKm])
  return null
}

export default function RadiusLocationPicker({
  position,
  radiusKm,
  onMove,
  onRadiusChange,
}: RadiusLocationPickerProps) {
  return (
    <div>
      <div className="h-72 rounded-lg overflow-hidden border relative">
        <MapContainer center={[position.lat, position.lng]} zoom={13} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <DraggableMarker position={position} onMove={onMove} />
          <Circle
            center={[position.lat, position.lng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 2 }}
          />
          <FitCircle position={position} radiusKm={radiusKm} />
          <LocateButton onLocate={onMove} showMarker={false} />
        </MapContainer>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <label className="text-sm text-gray-600 whitespace-nowrap">
          Radius: {radiusKm.toFixed(1)} km
        </label>
        <input
          type="range"
          min="0.5"
          max="50"
          step="0.5"
          value={radiusKm}
          onChange={(e) => onRadiusChange(parseFloat(e.target.value))}
          className="flex-1"
        />
      </div>
    </div>
  )
}
