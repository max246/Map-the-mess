import { useMap } from 'react-leaflet'
import { useState, useEffect } from 'react'
import L from 'leaflet'

interface LocateButtonProps {
  onLocate?: (pos: { lat: number; lng: number }) => void
  showMarker?: boolean
}

export default function LocateButton({ onLocate, showMarker = true }: LocateButtonProps) {
  const map = useMap()
  const [locating, setLocating] = useState(false)
  const locationLayerRef = useState<L.LayerGroup>(() => L.layerGroup())[0]

  useEffect(() => {
    locationLayerRef.addTo(map)
    return () => {
      locationLayerRef.remove()
    }
  }, [map, locationLayerRef])

  const handleLocate = () => {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        locationLayerRef.clearLayers()
        if (showMarker) {
          L.circle([latitude, longitude], {
            radius: accuracy,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            weight: 1,
          }).addTo(locationLayerRef)
          const pulseIcon = L.divIcon({
            className: '',
            html: `<div style="position:relative;width:40px;height:40px">
              <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:14px;height:14px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(59,130,246,0.5);z-index:2"></div>
              <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:14px;height:14px;background:rgba(59,130,246,0.4);border-radius:50%;animation:loc-pulse 2s ease-out infinite;z-index:1"></div>
            </div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          })
          L.marker([latitude, longitude], { icon: pulseIcon, interactive: false }).addTo(
            locationLayerRef
          )
        }
        map.flyTo([latitude, longitude], 18, { duration: 0.8 })
        onLocate?.({ lat: latitude, lng: longitude })
        setLocating(false)
      },
      () => {
        alert('Could not get your location. Please allow location access.')
        setLocating(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    )
  }

  return (
    <button
      type="button"
      onClick={handleLocate}
      disabled={locating}
      className="absolute bottom-3 right-3 z-[1000] bg-white shadow-lg rounded-lg w-10 h-10 flex items-center justify-center text-lg hover:bg-gray-50 transition disabled:opacity-50 border border-gray-300"
      title="Centre on my location"
    >
      {locating ? '...' : '📍'}
    </button>
  )
}
