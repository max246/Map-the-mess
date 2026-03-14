import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { useState, useEffect } from 'react'
import { getReports } from '../api/endpoints/reports/reports'
import ReportPopup from '../components/ReportPopup'

const { listReportsApiReportsGet } = getReports()

// Default centre: somewhere in Britain
const UK_CENTER = [53.5, -1.5]

export default function MapView() {
  const [reports, setReports] = useState([])

  useEffect(() => {
    listReportsApiReportsGet()
      .then(data => setReports(data))
      .catch(console.error)
  }, [])

  return (
    <div className="h-[calc(100vh-64px)]">
      <MapContainer center={UK_CENTER} zoom={6} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup chunkedLoading>
          {reports.map((r) => (
            <Marker key={r.id} position={[r.latitude, r.longitude]}>
              <ReportPopup report={r} />
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  )
}
