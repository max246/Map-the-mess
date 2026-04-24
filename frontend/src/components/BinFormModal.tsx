import { useState } from 'react'
import LocationPicker from './LocationPicker'
import { getBins } from '../api/endpoints/bins/bins'
import type { BinRead } from '../api/model'

const { createBinApiBinsPost, updateBinApiBinsBinIdPatch } = getBins()

interface Position {
  lat: number
  lng: number
}

interface BinFormModalProps {
  initialPosition: Position | null
  existing: BinRead | null
  onClose: () => void
  onSaved: (bin: BinRead) => void
}

export default function BinFormModal({
  initialPosition,
  existing,
  onClose,
  onSaved,
}: BinFormModalProps) {
  const [position, setPosition] = useState<Position | null>(
    existing ? { lat: existing.latitude, lng: existing.longitude } : initialPosition
  )
  const [description, setDescription] = useState(existing?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!position) {
      setError('Please pick a location')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (existing) {
        const updated = await updateBinApiBinsBinIdPatch(existing.id, {
          latitude: position.lat,
          longitude: position.lng,
          description,
        })
        onSaved(updated)
      } else {
        const created = await createBinApiBinsPost({
          latitude: position.lat,
          longitude: position.lng,
          description,
        })
        onSaved(created)
      }
    } catch (err) {
      const message =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null
      setError(message || 'Failed to save bin')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {existing ? 'Edit bin' : 'Add a bin'}
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Drag the pin or tap the map to set the bin's location.
          </p>

          <LocationPicker position={position} onMove={setPosition} />

          <label className="block text-xs font-medium text-gray-500 mt-4 mb-1">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="e.g. Next to the bus stop"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700"
          />

          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

          <div className="flex gap-2 justify-end mt-4">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !position}
              className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : existing ? 'Save' : 'Add bin'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
