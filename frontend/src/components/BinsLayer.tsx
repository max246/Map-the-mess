import { useEffect, useState } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import { getBins } from '../api/endpoints/bins/bins'
import BinMarker from './BinMarker'
import type { BinRead } from '../api/model'

const { listBinsApiBinsGet } = getBins()

const BIN_ZOOM_THRESHOLD = 16
const FETCH_RADIUS_KM = 2

interface BinsLayerProps {
  onEdit: (bin: BinRead) => void
  onDelete: (bin: BinRead) => void
  refreshKey: number
}

export default function BinsLayer({ onEdit, onDelete, refreshKey }: BinsLayerProps) {
  const map = useMap()
  const [bins, setBins] = useState<BinRead[]>([])
  const [zoom, setZoom] = useState(() => map.getZoom())
  const [center, setCenter] = useState(() => map.getCenter())

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    moveend: () => setCenter(map.getCenter()),
  })

  const visible = zoom >= BIN_ZOOM_THRESHOLD

  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (!visible) setBins([])
  }

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    listBinsApiBinsGet({
      latitude: center.lat,
      longitude: center.lng,
      radius_km: FETCH_RADIUS_KM,
    })
      .then((data) => {
        if (!cancelled) setBins(data)
      })
      .catch(() => {
        if (!cancelled) setBins([])
      })
    return () => {
      cancelled = true
    }
  }, [visible, center.lat, center.lng, refreshKey])

  if (!visible) return null

  return (
    <>
      {bins.map((bin) => (
        <BinMarker key={bin.id} bin={bin} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </>
  )
}
