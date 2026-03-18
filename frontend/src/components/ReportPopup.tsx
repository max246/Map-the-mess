import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Popup } from 'react-leaflet'
import { reverseGeocode } from '../api/geocode'
import { thumbnailUrl } from '../api/client'
import { getVolunteers } from '../api/endpoints/volunteers/volunteers'
import { useAuth } from '../context/AuthContext'
import type { ReportRead, ReportImageRead } from '../api/model'

const {
  listFavouritesApiVolunteersFavouritesGet,
  addFavouriteApiVolunteersFavouritesReportIdPost,
  removeFavouriteApiVolunteersFavouritesReportIdDelete,
} = getVolunteers()

function getPopupImage(report: ReportRead): ReportImageRead | null {
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

interface ReportPopupProps {
  report: ReportRead
}

export default function ReportPopup({ report }: ReportPopupProps) {
  const navigate = useNavigate()
  const { isLoggedIn } = useAuth()
  const [address, setAddress] = useState<{ displayName: string } | null>(null)
  const [isFavourite, setIsFavourite] = useState(false)

  useEffect(() => {
    reverseGeocode(report.latitude, report.longitude)
      .then(setAddress)
      .catch(() => {})
  }, [report.latitude, report.longitude])

  useEffect(() => {
    if (!isLoggedIn) return
    listFavouritesApiVolunteersFavouritesGet()
      .then((favs) => setIsFavourite(favs.some((r) => r.id === report.id)))
      .catch(() => {})
  }, [report.id, isLoggedIn])

  const toggleFavourite = async () => {
    try {
      if (isFavourite) {
        await removeFavouriteApiVolunteersFavouritesReportIdDelete(report.id)
        setIsFavourite(false)
      } else {
        await addFavouriteApiVolunteersFavouritesReportIdPost(report.id)
        setIsFavourite(true)
      }
    } catch {
      // silently fail in popup
    }
  }

  const image = getPopupImage(report)

  return (
    <Popup>
      <div style={{ minWidth: '200px' }}>
        {/* Image */}
        {image ? (
          <img
            src={thumbnailUrl(image)}
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

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          <button
            onClick={() => navigate(`/report/${report.id}`)}
            style={{
              flex: 1,
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
          {isLoggedIn && (
            <button
              onClick={toggleFavourite}
              style={{
                padding: '6px 10px',
                backgroundColor: isFavourite ? '#fef9c3' : '#f9fafb',
                border: isFavourite ? '1px solid #fcd34d' : '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                lineHeight: 1,
              }}
              title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
            >
              {isFavourite ? '★' : '☆'}
            </button>
          )}
        </div>
      </div>
    </Popup>
  )
}
