import { useState } from 'react'
import api from '../api/client'

export default function ReportLitter() {
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState(null)
  const [location, setLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Get user's current location
  const getLocation = () => {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        alert('Could not get your location. Please allow location access.')
        setLocating(false)
      }
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!location) {
      alert('Please share your location before submitting.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/reports/', {
        latitude: location.lat,
        longitude: location.lng,
        description,
        photo_url: null
      })
      alert('Report submitted successfully!')
      setDescription('')
      setPhoto(null)
      setLocation(null)
    } catch (err) {
      alert('Failed to submit report. Please try again.')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">📸 Report Litter</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Photo upload */}
        <label className="flex flex-col gap-1">
          <span className="font-medium">Photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setPhoto(e.target.files[0])}
            className="border rounded p-2"
          />
        </label>

        {/* Description */}
        <label className="flex flex-col gap-1">
          <span className="font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What did you see? e.g. Pile of rubbish bags near bus stop"
            rows={3}
            className="border rounded p-2 resize-none"
          />
        </label>

        {/* Location */}
        <div>
          <span className="font-medium block mb-1">Location</span>
          {location ? (
            <p className="text-sm text-gray-600">
              📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </p>
          ) : (
            <button
              type="button"
              onClick={getLocation}
              disabled={locating}
              className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded text-sm"
            >
              {locating ? 'Getting location...' : '📍 Use My Location'}
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  )
}
