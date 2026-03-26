import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getCommunities } from '../api/endpoints/communities/communities'
import { useAuth } from '../context/AuthContext'
import RadiusLocationPicker from '../components/RadiusLocationPicker'

const { createCommunityApiCommunitiesPost, uploadProfileImageApiCommunitiesCommunityIdImagePut } =
  getCommunities()

const UK_CENTER = { lat: 53.5, lng: -1.5 }

export default function CreateCommunity() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [facebookUrl, setFacebookUrl] = useState('')
  const [position, setPosition] = useState(UK_CENTER)
  const [radiusKm, setRadiusKm] = useState(5)
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [locating, setLocating] = useState(true)

  useEffect(() => {
    if (!isLoggedIn) navigate('/login', { replace: true })
  }, [isLoggedIn, navigate])

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const community = await createCommunityApiCommunitiesPost({
        name: name.trim(),
        description: description.trim(),
        latitude: position.lat,
        longitude: position.lng,
        radius_km: radiusKm,
        facebook_url: facebookUrl.trim() || undefined,
      })
      if (image) {
        await uploadProfileImageApiCommunitiesCommunityIdImagePut(community.id, { file: image })
      }
      navigate(`/communities/${community.id}`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to create community'
      setError(msg)
      setSubmitting(false)
    }
  }

  if (!isLoggedIn) return null

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link to="/communities" className="text-sm text-brand underline mb-4 inline-block">
        ← Back to communities
      </Link>

      <h1 className="text-2xl font-bold mb-6">Create Community</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. Bristol Litter Pickers"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Tell people about your community..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Profile image (optional)</label>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleImageSelect}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Preview"
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl">
                🏘️
              </div>
            )}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="text-sm text-brand hover:underline"
            >
              {imagePreview ? 'Change image' : 'Upload image'}
            </button>
            {imagePreview && (
              <button
                type="button"
                onClick={() => {
                  setImage(null)
                  setImagePreview(null)
                }}
                className="text-sm text-gray-400 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Facebook page (optional)</label>
          <input
            type="url"
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="https://facebook.com/..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Location & coverage area</label>
          <p className="text-xs text-gray-500 mb-2">
            Drag the pin or click the map to set the centre. Adjust the slider to define the area.
          </p>
          {!locating && (
            <RadiusLocationPicker
              position={position}
              radiusKm={radiusKm}
              onMove={setPosition}
              onRadiusChange={setRadiusKm}
            />
          )}
          {locating && (
            <div className="h-72 rounded-lg border flex items-center justify-center text-gray-400">
              Getting your location...
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="w-full bg-brand text-white py-2 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Community'}
        </button>
      </form>
    </div>
  )
}
