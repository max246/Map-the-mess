import L from 'leaflet'
import { Marker, Popup } from 'react-leaflet'
import { useAuth } from '../context/AuthContext'
import type { BinRead } from '../api/model'

const BIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
  <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#0ea5e9" stroke="#fff" stroke-width="1.5"/>
  <path d="M8 9h8l-.8 9.5a1.5 1.5 0 01-1.5 1.4h-3.4a1.5 1.5 0 01-1.5-1.4L8 9zm2-2h4v1.2h-4V7z" fill="#fff"/>
</svg>`

export const binIcon = L.icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(BIN_SVG)}`,
  iconSize: [28, 42],
  iconAnchor: [14, 42],
  popupAnchor: [0, -42],
})

interface BinMarkerProps {
  bin: BinRead
  onEdit: (bin: BinRead) => void
  onDelete: (bin: BinRead) => void
}

export default function BinMarker({ bin, onEdit, onDelete }: BinMarkerProps) {
  const { user, isModerator, isAdmin } = useAuth()
  const canModify = !!user && (bin.created_by_user_id === user.id || isModerator || isAdmin)

  return (
    <Marker position={[bin.latitude, bin.longitude]} icon={binIcon}>
      <Popup>
        <div style={{ minWidth: '180px' }}>
          <strong style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>
            🗑️ Public bin
          </strong>
          {bin.description && (
            <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#374151' }}>
              {bin.description}
            </p>
          )}
          {bin.address && (
            <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#6b7280' }}>{bin.address}</p>
          )}
          {canModify && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <button
                onClick={() => onEdit(bin)}
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
                Edit
              </button>
              <button
                onClick={() => onDelete(bin)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  )
}
