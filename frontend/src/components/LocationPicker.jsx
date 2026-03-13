import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { useState, useRef, useMemo } from 'react'

function DraggableMarker({ position, onMove }) {
  const markerRef = useRef(null)

  const eventHandlers = useMemo(() => ({
    dragend() {
      const marker = markerRef.current
      if (marker) {
        const { lat, lng } = marker.getLatLng()
        onMove({ lat, lng })
      }
    }
  }), [onMove])

  // Also allow clicking the map to reposition
  useMapEvents({
    click(e) {
      onMove({ lat: e.latlng.lat, lng: e.latlng.lng })
    }
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

export default function LocationPicker({ position, onMove }) {
  return (
    <div className="h-64 rounded-lg overflow-hidden border">
      <MapContainer
        center={[position.lat, position.lng]}
        zoom={16}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DraggableMarker position={position} onMove={onMove} />
      </MapContainer>
    </div>
  )
}
