import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { useState, useEffect } from 'react'
// import api from '../api/client'

// Default centre: somewhere in Britain
const UK_CENTER = [53.5, -1.5]

export default function MapView() {
  const [reports, setReports] = useState([])

  useEffect(() => {
    // TODO: fetch from API
    // api.get('/reports').then(r => setReports(r.data))
    setReports([
      { id: 1, latitude: 51.505, longitude: -0.09, description: 'Example: rubbish near Tower Bridge', status: 'pending' }
    ])
  }, [])

  return (
    <div className="h-[calc(100vh-64px)]">
      <MapContainer center={UK_CENTER} zoom={6} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {reports.map((r) => (
          <Marker key={r.id} position={[r.latitude, r.longitude]}>
            <Popup>
              <strong>{r.status === 'cleaned' ? '✅' : '🔴'} {r.description}</strong>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
