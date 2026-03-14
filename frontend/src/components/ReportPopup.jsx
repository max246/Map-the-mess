import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Popup } from 'react-leaflet'
import { reverseGeocode } from '../api/geocode'
import { API_BASE_URL } from '../api/client'

function getPopupImage(report) {
  const images = report.images || []
  if (images.length === 0) return null

  if (report.status === 'cleaned') {
    const resolvedImages = images.filter((img) => img.image_type === 'resolved')
    if (resolvedImages.length > 0) {
      return resolvedImages[resolvedImages.length - 1]
    }
  }

  const reportImages = images.filter((img) => img.image_type === 'report')
  return reportImages[0] || images[0]
}

export default function ReportPopup({ report }) {
  const navigate = useNavigate()
  const [address, setAddress] = useState(null)

  useEffect(() => {
    reverseGeocode(report.latitude, report.longitude)
      .then(setAddress)
      .catch(() => {})
  }, [report.latitude, report.longitude])

  const image = getPopupImage(report)

  return (
    <Popup>
      <div style={{ minWidth: '200px' }}>
        {/* Image */}
        {image ? (
          <img
            src={`${API_BASE_URL}/api/reports/images/${image.url}`}
            alt="Report"
            style={{
              width: '100%',
              height: '120px',
              objectFit: 'cover',
              borderRadius: '4px',
              marginBottom: '8px',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '120px',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              fontSize: '24px',
            }}
          >
            📷
          </div>
        )}

        {/* Status + description */}
        <strong style={{ fontSize: '14px' }}>
          {report.status === 'cleaned' ? '✅' : '🔴'} {report.description || 'No description'}
        </strong>

        {/* Address */}
        {address && (
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#6b7280' }}>
            {address.displayName}
          </p>
        )}

        {/* what3words */}
        {report.what3words && (
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#e11d48', fontWeight: 500 }}>
            /// {report.what3words}
          </p>
        )}

        {/* Open button */}
        <button
          onClick={() => navigate(`/report/${report.id}`)}
          style={{
            marginTop: '10px',
            width: '100%',
            padding: '6px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          Open Report
        </button>
      </div>
    </Popup>
  )
}
