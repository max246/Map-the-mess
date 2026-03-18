import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { useState, useEffect } from 'react'
import { getReports } from '../api/endpoints/reports/reports'
import ReportPopup from '../components/ReportPopup'
import type { ReportRead } from '../api/model'

const { listReportsApiReportsGet } = getReports()

// Default centre: somewhere in Britain
const UK_CENTER: [number, number] = [53.5, -1.5]
const MIN_ZOOM_ON_CLICK = 15

function ZoomMarker({ report }: { report: ReportRead }) {
  const map = useMap()

  const handleClick = () => {
    if (map.getZoom() < MIN_ZOOM_ON_CLICK) {
      map.flyTo([report.latitude, report.longitude], MIN_ZOOM_ON_CLICK)
    }
  }

  return (
    <Marker position={[report.latitude, report.longitude]} eventHandlers={{ click: handleClick }}>
      <ReportPopup report={report} />
    </Marker>
  )
}

export default function MapView() {
  const [reports, setReports] = useState<ReportRead[]>([])

  useEffect(() => {
    listReportsApiReportsGet()
      .then((data) => setReports(data))
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
            <ZoomMarker key={r.id} report={r} />
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  )
}
