import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import axios from 'axios'
import { reverseGeocode } from '../api/geocode'
import { useAuth } from '../context/AuthContext'

export default function ReportDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token, canManageUsers, isLoggedIn } = useAuth()
  const [report, setReport] = useState(null)
  const [address, setAddress] = useState(null)
  const [error, setError] = useState(null)
  const [activePhoto, setActivePhoto] = useState(0)

  // Resolve form state
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [resolverName, setResolverName] = useState('')
  const [resolverEmail, setResolverEmail] = useState('')
  const [resolvePhotos, setResolvePhotos] = useState([])
  const [resolvePhotoPreviews, setResolvePhotoPreviews] = useState([])
  const [resolving, setResolving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef(null)

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  const fetchReport = () => {
    axios.get(`/api/reports/${id}`)
      .then(res => {
        setReport(res.data)
        return reverseGeocode(res.data.latitude, res.data.longitude)
      })
      .then(setAddress)
      .catch(() => setError('Report not found'))
  }

  useEffect(() => { fetchReport() }, [id])

  // Build image URLs from report.images array
  const reportImages = report?.images?.filter(img => img.image_type === 'report') || []
  const resolvedImages = report?.images?.filter(img => img.image_type === 'resolved') || []
  const allPhotos = [...reportImages, ...resolvedImages]

  const imageUrl = (img) => `/api/reports/images/${img.url}`

  const handleResolvePhotos = (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setResolvePhotos(prev => [...prev, ...files])

    files.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setResolvePhotoPreviews(prev => [...prev, reader.result])
      }
      reader.readAsDataURL(file)
    })

    fileInputRef.current.value = ''
  }

  const removeResolvePhoto = (index) => {
    setResolvePhotos(prev => prev.filter((_, i) => i !== index))
    setResolvePhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleResolve = async (e) => {
    e.preventDefault()
    if (resolvePhotos.length === 0) {
      alert('Please upload at least one photo.')
      return
    }
    if (!isLoggedIn && (!resolverName.trim() || !resolverEmail.trim())) {
      alert('Please fill in your name and email.')
      return
    }
    setResolving(true)
    try {
      // Upload resolve photos
      for (const file of resolvePhotos) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('image_type', 'resolved')
        await axios.post(`/api/reports/${id}/images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data', ...authHeaders }
        })
      }

      // Mark as cleaned
      const res = await axios.patch(`/api/reports/${id}/clean`, undefined, {
        headers: authHeaders
      })
      setReport(res.data)
      setShowResolveForm(false)
      setResolvePhotos([])
      setResolvePhotoPreviews([])
      setResolverName('')
      setResolverEmail('')
      // Re-fetch to get updated images
      fetchReport()
    } catch {
      alert('Failed to resolve report. Please try again.')
    } finally {
      setResolving(false)
    }
  }

  const handleUnresolve = async () => {
    try {
      const res = await axios.patch(`/api/reports/${id}/unresolve`, undefined, {
        headers: authHeaders
      })
      setReport(res.data)
    } catch {
      alert('Failed to unresolve report.')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this report? This cannot be undone.')) return
    setDeleting(true)
    try {
      await axios.delete(`/api/reports/${id}`, { headers: authHeaders })
      navigate('/admin')
    } catch {
      alert('Failed to delete report.')
      setDeleting(false)
    }
  }

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

      {/* Photos */}
      <div className="mb-6">
        {allPhotos.length > 0 ? (
          <div>
            <div className="relative">
              <img
                src={imageUrl(allPhotos[activePhoto])}
                alt={`Report photo ${activePhoto + 1}`}
                className="w-full rounded-lg object-cover max-h-96"
              />
              {allPhotos[activePhoto].image_type === 'resolved' && (
                <span className="absolute top-2 left-2 bg-green-600 text-white text-xs font-medium px-2 py-1 rounded">
                  Resolved
                </span>
              )}
            </div>
            {allPhotos.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {allPhotos.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setActivePhoto(i)}
                    className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                      i === activePhoto ? 'border-brand' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={imageUrl(img)} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                    {img.image_type === 'resolved' && (
                      <span className="absolute bottom-0 left-0 right-0 bg-green-600 text-white text-center text-[8px] leading-tight py-0.5">
                        Resolved
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
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
              {report.status === 'cleaned' ? '✅ Cleaned' : '🔴 Pending'}
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

          {report.resolved_at && (
            <div>
              <span className="text-gray-500">Resolved on</span>
              <p>{new Date(report.resolved_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}</p>
            </div>
          )}
        </div>
      </div>

      {/* Resolve section */}
      {report.status !== 'cleaned' && (
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          {!showResolveForm ? (
            <button
              onClick={() => setShowResolveForm(true)}
              className="w-full bg-brand text-white font-semibold py-3 rounded-lg hover:bg-brand-dark transition"
            >
              Mark as Resolved
            </button>
          ) : (
            <form onSubmit={handleResolve}>
              <h2 className="font-semibold mb-4">Resolve Report</h2>

              {/* Photo upload */}
              <div className="mb-4">
                <label className="block text-sm text-gray-500 mb-1">
                  Upload proof photos <span className="text-red-500">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleResolvePhotos}
                  className="hidden"
                />
                {resolvePhotoPreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {resolvePhotoPreviews.map((preview, i) => (
                      <div key={i} className="relative">
                        <img
                          src={preview}
                          alt={`Proof ${i + 1}`}
                          className="w-full h-24 rounded-lg object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeResolvePhoto(i)}
                          className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-opacity-70"
                        >
                          X
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current.click()}
                  className="w-full h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-brand hover:text-brand transition"
                >
                  <span className="text-2xl mb-1">+</span>
                  <span className="text-xs">{resolvePhotoPreviews.length > 0 ? 'Add more photos' : 'Click to upload photos'}</span>
                </button>
              </div>

              {/* Name & Email — only for anonymous users */}
              {!isLoggedIn && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm text-gray-500 mb-1">
                      Your name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={resolverName}
                      onChange={(e) => setResolverName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm text-gray-500 mb-1">
                      Your email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={resolverEmail}
                      onChange={(e) => setResolverEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                      required
                    />
                  </div>
                </>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={resolving}
                  className="flex-1 bg-brand text-white font-semibold py-2.5 rounded-lg hover:bg-brand-dark transition disabled:opacity-50"
                >
                  {resolving ? 'Submitting...' : 'Submit Resolution'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResolveForm(false)}
                  className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Resolved info */}
      {report.status === 'cleaned' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-green-800 mb-1">Resolved</h2>
              <p className="text-sm text-green-700">
                This report has been marked as cleaned.
              </p>
            </div>
            {canManageUsers && (
              <button
                onClick={handleUnresolve}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium hover:underline"
              >
                Mark as Unresolved
              </button>
            )}
          </div>
        </div>
      )}

      {/* Admin actions */}
      {canManageUsers && (
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <h2 className="font-semibold mb-3 text-gray-700">Admin Actions</h2>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete Report'}
          </button>
        </div>
      )}

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
