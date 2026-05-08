import { useState, useRef, useEffect, type ChangeEvent, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import LocationPicker from '../components/LocationPicker'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function ReportCollection() {
  const { isLoggedIn } = useAuth()
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation((prev) => prev ?? { lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  }, [])

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />
  }

  const handlePhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    const reader = new FileReader()
    reader.onloadend = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const removePhoto = () => {
    setPhoto(null)
    setPhotoPreview(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!location) {
      alert('Please share your location before submitting.')
      return
    }

    setSubmitting(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('latitude', location.lat.toString())
      formData.append('longitude', location.lng.toString())
      formData.append('description', description)
      if (photo) formData.append('image', photo)

      await api.post('/api/reports/fixmystreet', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
        onUploadProgress: (ev) => {
          if (ev.total) setUploadProgress(Math.round((ev.loaded / ev.total) * 100))
        },
      })

      setUploadProgress(100)
      setSubmitted(true)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 400) {
        alert('Location must be within the United Kingdom.')
      } else if (status === 502) {
        alert('FixMyStreet rejected the submission. Please try again later.')
      } else {
        alert('Failed to submit report. Please try again.')
      }
      console.error(err)
    } finally {
      setSubmitting(false)
      setUploadProgress(0)
    }
  }

  if (submitted) {
    const resetForm = () => {
      setSubmitted(false)
      setDescription('')
      setPhoto(null)
      setPhotoPreview(null)
      setLocation(null)
    }
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-6">📨</div>
        <h1 className="text-2xl font-bold mb-3">Forwarded to FixMyStreet</h1>
        <p className="text-gray-600 mb-8">
          We've sent your report to FixMyStreet. They'll email you to confirm — please open the
          email to finalise the submission.
        </p>
        <div className="flex flex-col gap-3 items-center">
          <button onClick={resetForm} className="text-brand underline text-sm">
            Submit another report
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <PageMeta
        title="Report Collection"
        description="Forward a fly-tipping or large-waste collection request straight to FixMyStreet."
      />
      <h1 className="text-2xl font-bold mb-2">📨 Report Collection</h1>
      <p className="text-sm text-gray-600 mb-6">
        Forward a fly-tipping or large-waste collection request to FixMyStreet. They'll email you to
        confirm before the report goes live.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="font-medium">Photo</span>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhoto}
            className="hidden"
          />
          {photoPreview ? (
            <div className="relative w-32 h-32">
              <img
                src={photoPreview}
                alt="Upload"
                className="w-full h-full rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-opacity-70"
              >
                X
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-brand hover:text-brand transition"
            >
              <span className="text-2xl mb-1">+</span>
              <span className="text-sm">Click to upload one photo</span>
            </button>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's been dumped? e.g. Mattress and bin bags by the lay-by"
            rows={3}
            className="border rounded p-2 resize-none"
          />
        </label>

        <div>
          <span className="font-medium block mb-1">
            Location <span className="text-red-500">*</span>
          </span>
          {location ? (
            <p className="text-sm text-gray-600 mb-2">
              📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </p>
          ) : (
            <p className="text-sm text-gray-500 mb-2">
              Tap the map to place a pin, or use the 📍 button to find your location
            </p>
          )}
          <p className="text-xs text-gray-400 mb-2">Drag the pin or tap the map to adjust</p>
          <LocationPicker position={location} onMove={setLocation} />
          {location && (
            <button
              type="button"
              onClick={() => setLocation(null)}
              className="mt-2 text-sm text-gray-500 underline"
            >
              Reset location
            </button>
          )}
        </div>

        {submitting ? (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-medium text-gray-600">
              <span>Submitting…</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-brand h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            type="submit"
            className="bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            Send to FixMyStreet
          </button>
        )}
      </form>
    </div>
  )
}
