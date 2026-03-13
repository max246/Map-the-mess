import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import { getReports } from '../api/endpoints/reports/reports'
import { reverseGeocode } from '../api/geocode'
const { getReportApiReportsReportIdGet } = getReports()

export default function ReportDetail() {
  const { id } = useParams()
  const [report, setReport] = useState(null)
  const [address, setAddress] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getReportApiReportsReportIdGet(Number(id))
      .then(res => {
        setReport(res.data)
        return reverseGeocode(res.data.latitude, res.data.longitude)
      })
      .then(setAddress)
      .catch(() => setError('Report not found'))
  }, [id])

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-xl text-gray-500">{error}</p>
        <Link to="/map" className="text-brand underline mt-4 inline-block">Back to map</Link>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">
        Loading...
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/map" className="text-sm text-brand underline mb-4 inline-block">
        ← Back to map
      </Link>

      <h1 className="text-2xl font-bold mb-2">
        {report.status === 'cleaned' ? '✅' : '🔴'} Report #{report.id}
      </h1>

      <p className="text-sm text-gray-400 mb-6">
        Reported on {new Date(report.created_at).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })}
      </p>

      {/* Photo */}
      <div className="mb-6">
        {report.photo_url ? (
          <img
            src={report.photo_url}
            alt="Litter report"
            className="w-full rounded-lg object-cover max-h-96"
          />
        ) : (
          <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
            <div className="text-center">
              <span className="text-4xl block mb-2">📷</span>
              <span className="text-sm">No photo uploaded</span>
            </div>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <h2 className="font-semibold mb-3">Details</h2>

        <div className="grid gap-3 text-sm">
          <div>
            <span className="text-gray-500">Status</span>
            <p className="font-medium">
              {report.status === 'cleaned' ? '✅ Cleaned' : '🔴 Pending cleanup'}
            </p>
          </div>

          <div>
            <span className="text-gray-500">Description</span>
            <p>{report.description || 'No description provided'}</p>
          </div>

          {address && (
            <div>
              <span className="text-gray-500">Location</span>
              <p>{address.displayName}</p>
            </div>
          )}

          <div>
            <span className="text-gray-500">Coordinates</span>
            <p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${report.latitude},${report.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline"
              >
                {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
              </a>
              <span className="text-gray-400 text-xs ml-2">Open in Google Maps</span>
            </p>
          </div>

          {report.what3words && (
            <div>
              <span className="text-gray-500">what3words</span>
              <p>
                <a
                  href={`https://what3words.com/${report.what3words}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand font-medium underline"
                >
                  /// {report.what3words}
                </a>
                <span className="text-gray-400 text-xs ml-2">Open in what3words</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mini map */}
      <div className="rounded-lg overflow-hidden shadow h-64">
        <MapContainer
          center={[report.latitude, report.longitude]}
          zoom={16}
          className="h-full w-full"
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[report.latitude, report.longitude]} />
        </MapContainer>
      </div>
    </div>
  )
}
