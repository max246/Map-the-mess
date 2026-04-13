import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import PageMeta from '../components/PageMeta'
import LocateButton from '../components/LocateButton'
import api, { imageUrl, thumbnailUrl } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { getReports } from '../api/endpoints/reports/reports'
import { getVolunteers } from '../api/endpoints/volunteers/volunteers'
import type { ReportRead, ReportImageRead, ReportStatusLogRead } from '../api/model'

const {
  deleteImageApiReportsImagesImageIdDelete,
  addImageApiReportsReportIdImagesPost,
  updateReportApiReportsReportIdPatch,
} = getReports()
const {
  listFavouritesApiVolunteersFavouritesGet,
  addFavouriteApiVolunteersFavouritesReportIdPost,
  removeFavouriteApiVolunteersFavouritesReportIdDelete,
} = getVolunteers()

export default function ReportDetail() {
  const { id } = useParams() as { id: string }
  const navigate = useNavigate()
  const { token, user, canManageUsers, isLoggedIn } = useAuth()
  const [report, setReport] = useState<ReportRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activePhoto, setActivePhoto] = useState(0)

  // Resolve form state
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [resolverName, setResolverName] = useState('')
  const [resolverEmail, setResolverEmail] = useState('')
  const [resolvePhotos, setResolvePhotos] = useState<File[]>([])
  const [resolvePhotoPreviews, setResolvePhotoPreviews] = useState<string[]>([])
  const [resolving, setResolving] = useState(false)
  const [resolveProgress, setResolveProgress] = useState(0)
  const [resolveLabel, setResolveLabel] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [lightboxPhotos, setLightboxPhotos] = useState<ReportImageRead[]>([])
  const [isFavourite, setIsFavourite] = useState(false)
  const [addingPhoto, setAddingPhoto] = useState(false)
  const [showReopenForm, setShowReopenForm] = useState(false)
  const [reopenPhoto, setReopenPhoto] = useState<File | null>(null)
  const [reopenPhotoPreview, setReopenPhotoPreview] = useState<string | null>(null)
  const [reopening, setReopening] = useState(false)
  const [editData, setEditData] = useState<{
    description: string
    report_type: string
    what3words: string
    remove_image_ids: string[]
  } | null>(null)
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const addPhotoInputRef = useRef<HTMLInputElement>(null)
  const reopenFileInputRef = useRef<HTMLInputElement>(null)

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  const fetchReport = () => {
    api
      .get(`/api/reports/${id}`)
      .then((res) => {
        setReport(res.data)
      })
      .catch(() => setError('Report not found'))
  }

  useEffect(() => {
    fetchReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!isLoggedIn || !id) return
    listFavouritesApiVolunteersFavouritesGet()
      .then((favs) => setIsFavourite(favs.some((r) => r.id === id)))
      .catch(() => {})
  }, [id, isLoggedIn])

  const toggleFavourite = async () => {
    if (!id) return
    try {
      if (isFavourite) {
        await removeFavouriteApiVolunteersFavouritesReportIdDelete(id!)
        setIsFavourite(false)
      } else {
        await addFavouriteApiVolunteersFavouritesReportIdPost(id!)
        setIsFavourite(true)
      }
    } catch {
      alert('Failed to update favourite.')
    }
  }

  const isOwner = !!user && !!report?.created_by_user_id && user.id === report.created_by_user_id
  const canEdit = canManageUsers || isOwner

  // Build image URLs — only show current cycle in the main gallery
  const currentCycle = report?.current_cycle ?? 0
  const currentImages = report?.images?.filter((img) => img.cycle === currentCycle) || []
  const currentReportImages = currentImages.filter((img) => img.image_type === 'report')
  const currentResolvedImages = currentImages.filter((img) => img.image_type === 'resolved')
  const allPhotos: ReportImageRead[] = [...currentReportImages, ...currentResolvedImages]

  // For timeline: track which cycle's images are expanded
  const [expandedCycle, setExpandedCycle] = useState<number | null>(null)

  const openLightbox = (photos: ReportImageRead[], index: number) => {
    setLightboxPhotos(photos)
    setLightboxIndex(index)
  }

  useEffect(() => {
    if (lightboxIndex === null) return
    const len = lightboxPhotos.length
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null)
      if (e.key === 'ArrowLeft') setLightboxIndex((prev) => ((prev ?? 0) - 1 + len) % len)
      if (e.key === 'ArrowRight') setLightboxIndex((prev) => ((prev ?? 0) + 1) % len)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [lightboxIndex, lightboxPhotos.length])

  const handleResolvePhotos = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setResolvePhotos((prev) => [...prev, ...files])

    files.forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setResolvePhotoPreviews((prev) => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeResolvePhoto = (index: number) => {
    setResolvePhotos((prev) => prev.filter((_, i) => i !== index))
    setResolvePhotoPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const handleResolve = async (e: FormEvent) => {
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
    setResolveProgress(0)
    const totalFiles = resolvePhotos.length
    try {
      // Upload resolve photos
      for (let i = 0; i < resolvePhotos.length; i++) {
        setResolveLabel(`Uploading photo ${i + 1} of ${totalFiles}...`)
        const formData = new FormData()
        formData.append('file', resolvePhotos[i])
        formData.append('image_type', 'resolved')
        await api.post(`/api/reports/${id}/images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data', ...authHeaders },
          timeout: 120000,
          onUploadProgress: (e) => {
            const fileProgress = e.total ? e.loaded / e.total : 0
            const overall = ((i + fileProgress) / totalFiles) * 100
            setResolveProgress(Math.round(overall))
          },
        })
      }

      setResolveProgress(100)
      setResolveLabel('Finalising...')

      // Mark as cleaned
      const res = await api.patch(`/api/reports/${id}/clean`, undefined, {
        headers: authHeaders,
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
      setResolveProgress(0)
      setResolveLabel('')
    }
  }

  const handleUnresolve = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    setReopening(true)
    try {
      let res
      if (reopenPhoto) {
        const formData = new FormData()
        formData.append('image', reopenPhoto)
        res = await api.patch(`/api/reports/${id}/unresolve`, formData, {
          headers: { 'Content-Type': 'multipart/form-data', ...authHeaders },
        })
      } else {
        res = await api.patch(`/api/reports/${id}/unresolve`, undefined, {
          headers: authHeaders,
        })
      }
      setReport(res.data)
      setShowReopenForm(false)
      setReopenPhoto(null)
      setReopenPhotoPreview(null)
      fetchReport()
    } catch {
      alert('Failed to reopen report.')
    } finally {
      setReopening(false)
    }
  }

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return
    try {
      await deleteImageApiReportsImagesImageIdDelete(imageId)
      setActivePhoto(0)
      fetchReport()
    } catch {
      alert('Failed to delete image.')
    }
  }

  const handleAddPhotos = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0 || !id) return
    setAddingPhoto(true)
    try {
      for (const file of files) {
        await addImageApiReportsReportIdImagesPost(id!, {
          image_type: 'report',
          file,
        })
      }
      fetchReport()
    } catch {
      alert('Failed to upload image.')
    } finally {
      setAddingPhoto(false)
      if (addPhotoInputRef.current) addPhotoInputRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this report? This cannot be undone.')) return
    setDeleting(true)
    try {
      await api.delete(`/api/reports/${id}`, { headers: authHeaders })
      navigate('/admin')
    } catch {
      alert('Failed to delete report.')
      setDeleting(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!report || !editData) return
    setSaving(true)
    try {
      const update: {
        description?: string
        report_type?: string
        what3words?: string
        remove_image_ids?: string[]
      } = {}
      if (editData.description !== (report.description || ''))
        update.description = editData.description
      if (editData.report_type !== report.report_type) update.report_type = editData.report_type
      if (editData.what3words !== (report.what3words || '')) update.what3words = editData.what3words
      if (editData.remove_image_ids.length > 0) update.remove_image_ids = editData.remove_image_ids
      if (Object.keys(update).length > 0) {
        await updateReportApiReportsReportIdPatch(id, update)
        fetchReport()
      }
      setEditData(null)
    } catch {
      alert('Failed to update report.')
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-xl text-gray-500">{error}</p>
        <Link to="/map" className="text-brand underline mt-4 inline-block">
          Back to map
        </Link>
      </div>
    )
  }

  if (!report) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">Loading...</div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <PageMeta
        title={`Report #${id.slice(-6)}`}
        description="View litter report details, location, and photos. Help resolve reports in your area."
      />
      <Link to="/map" className="text-sm text-brand underline mb-4 inline-block">
        ← Back to map
      </Link>

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">
          {report.status === 'cleaned' ? '✅' : '🔴'} Report #{report.id.slice(-6)}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const shareUrl = encodeURIComponent(window.location.href)
              window.open(
                `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
                '_blank',
                'noopener,noreferrer,width=600,height=400'
              )
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition border bg-white border-gray-300 text-gray-500 hover:border-brand hover:text-brand"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </button>
          {isLoggedIn && (
            <button
              onClick={toggleFavourite}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
                isFavourite
                  ? 'bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100'
                  : 'bg-white border-gray-300 text-gray-500 hover:border-yellow-400 hover:text-yellow-600'
              }`}
            >
              <span className="text-lg">{isFavourite ? '★' : '☆'}</span>
              {isFavourite ? 'Starred' : 'Star'}
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-6">
        Reported on{' '}
        {new Date(report.created_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
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
                className="w-full rounded-lg object-cover max-h-96 cursor-pointer"
                onClick={() => openLightbox(allPhotos, activePhoto)}
              />
              {allPhotos[activePhoto].image_type === 'resolved' && (
                <span className="absolute top-2 left-2 bg-green-600 text-white text-xs font-medium px-2 py-1 rounded">
                  Resolved
                </span>
              )}
              {canEdit && !editData && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteImage(allPhotos[activePhoto].id)
                  }}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-2 py-1 rounded transition"
                >
                  Delete
                </button>
              )}
              {editData && editData?.remove_image_ids.includes(allPhotos[activePhoto].id) && (
                <div className="absolute inset-0 bg-red-500 bg-opacity-30 rounded-lg flex items-center justify-center">
                  <span className="bg-red-600 text-white text-sm font-medium px-3 py-1 rounded">
                    Marked for removal
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {allPhotos.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() =>
                    editData
                      ? setEditData({
                          ...editData,
                          remove_image_ids: editData.remove_image_ids.includes(img.id)
                            ? editData.remove_image_ids.filter((x) => x !== img.id)
                            : [...editData.remove_image_ids, img.id],
                        })
                      : setActivePhoto(i)
                  }
                  className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                    editData && editData?.remove_image_ids.includes(img.id)
                      ? 'border-red-500 opacity-50'
                      : i === activePhoto
                        ? 'border-brand'
                        : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={thumbnailUrl(img)}
                    alt={`Thumbnail ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {editData && editData?.remove_image_ids.includes(img.id) && (
                    <span className="absolute inset-0 bg-red-500 bg-opacity-40 flex items-center justify-center text-white text-lg font-bold">
                      X
                    </span>
                  )}
                  {img.image_type === 'resolved' && (
                    <span className="absolute bottom-0 left-0 right-0 bg-green-600 text-white text-center text-[8px] leading-tight py-0.5">
                      Resolved
                    </span>
                  )}
                </button>
              ))}
              {report.status !== 'cleaned' && (
                <button
                  onClick={() => addPhotoInputRef.current?.click()}
                  disabled={addingPhoto}
                  className="flex-shrink-0 w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-brand hover:text-brand transition disabled:opacity-50"
                >
                  {addingPhoto ? '...' : '+'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-200 transition"
            onClick={() => report.status !== 'cleaned' && addPhotoInputRef.current?.click()}
          >
            <div className="text-center">
              <span className="text-4xl block mb-2">📷</span>
              <span className="text-sm">
                {report.status !== 'cleaned' ? 'Click to add a photo' : 'No photo uploaded'}
              </span>
            </div>
          </div>
        )}
        <input
          ref={addPhotoInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleAddPhotos}
          className="hidden"
        />
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && lightboxPhotos.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 text-white text-3xl font-bold hover:text-gray-300 z-10"
          >
            X
          </button>

          {lightboxPhotos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setLightboxIndex(
                    (lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length
                  )
                }}
                className="absolute left-4 text-white text-4xl font-bold hover:text-gray-300 z-10"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setLightboxIndex((lightboxIndex + 1) % lightboxPhotos.length)
                }}
                className="absolute right-4 text-white text-4xl font-bold hover:text-gray-300 z-10"
              >
                ›
              </button>
            </>
          )}

          <img
            src={imageUrl(lightboxPhotos[lightboxIndex])}
            alt={`Full size photo ${lightboxIndex + 1}`}
            className="max-w-full max-h-full object-contain p-4"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="absolute bottom-4 text-white text-sm">
            {lightboxIndex + 1} / {lightboxPhotos.length}
            {lightboxPhotos[lightboxIndex].image_type === 'resolved' && (
              <span className="ml-2 bg-green-600 text-xs px-2 py-0.5 rounded">Resolved</span>
            )}
          </div>
        </div>
      )}

      {/* Details */}
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Details</h2>
          {canEdit && !editData && (
            <button
              onClick={() =>
                report &&
                setEditData({
                  description: report.description || '',
                  report_type: report.report_type || 'litter',
                  what3words: report.what3words || '',
                  remove_image_ids: [],
                })
              }
              className="text-sm text-brand hover:underline font-medium"
            >
              Edit
            </button>
          )}
          {editData && (
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="text-sm bg-brand text-white px-3 py-1 rounded-lg hover:bg-brand-dark transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setEditData(null)}
                disabled={saving}
                className="text-sm border border-gray-300 text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {editData && editData?.remove_image_ids.length > 0 && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {editData?.remove_image_ids.length} image
            {editData?.remove_image_ids.length > 1 ? 's' : ''} marked for removal. Click thumbnails
            above to toggle.
          </div>
        )}

        <div className="grid gap-3 text-sm">
          <div>
            <span className="text-gray-500">Status</span>
            <p className="font-medium">
              {report.status === 'cleaned' ? '✅ Cleaned' : '🔴 Pending'}
            </p>
          </div>

          <div>
            <span className="text-gray-500">Type</span>
            {editData ? (
              <select
                value={editData.report_type}
                onChange={(e) => setEditData({ ...editData, report_type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand mt-1"
              >
                <option value="litter">Litter</option>
                <option value="gas_canister">Gas Canister</option>
              </select>
            ) : (
              <p className="font-medium">
                {report.report_type === 'gas_canister' ? 'Gas Canister' : 'Litter'}
              </p>
            )}
          </div>

          <div>
            <span className="text-gray-500">Description</span>
            {editData ? (
              <textarea
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand mt-1"
                placeholder="Enter description..."
              />
            ) : (
              <p>{report.description || 'No description provided'}</p>
            )}
          </div>

          {report.address && (
            <div>
              <span className="text-gray-500">Location</span>
              <p>{report.address}</p>
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

          {(report.what3words || editData) && (
            <div>
              <span className="text-gray-500">what3words</span>
              {editData ? (
                <input
                  type="text"
                  value={editData.what3words}
                  onChange={(e) => setEditData({ ...editData, what3words: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand mt-1"
                  placeholder="e.g. filled.count.soap"
                />
              ) : (
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
              )}
            </div>
          )}

          {report.resolved_at && (
            <div>
              <span className="text-gray-500">Resolved on</span>
              <p>
                {new Date(report.resolved_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      {report.status_log && report.status_log.length > 0 && (
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <h2 className="font-semibold mb-4">History</h2>
          <div className="relative">
            {report.status_log.map((entry: ReportStatusLogRead, i: number) => {
              const isLast = i === report.status_log!.length - 1
              const cycleImages = (report.images || []).filter((img) => img.cycle === entry.cycle)
              const hasPastImages = cycleImages.length > 0 && entry.cycle !== currentCycle
              const isExpanded = expandedCycle === entry.cycle

              let dotColor = 'bg-gray-400'
              let label = 'Reported'
              if (entry.action === 'cleaned') {
                dotColor = 'bg-green-500'
                label = 'Resolved'
              } else if (entry.action === 'reopened') {
                dotColor = 'bg-orange-500'
                label = 'Reopened'
              }

              return (
                <div key={entry.id} className="flex gap-3">
                  {/* Vertical line + dot */}
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${dotColor} flex-shrink-0 mt-1`} />
                    {!isLast && <div className="w-0.5 bg-gray-200 flex-1 min-h-[24px]" />}
                  </div>

                  {/* Content */}
                  <div className={`pb-4 ${isLast ? '' : ''}`}>
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(entry.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>

                    {/* Show photos from older cycles */}
                    {hasPastImages && (
                      <div className="mt-1">
                        <button
                          onClick={() => setExpandedCycle(isExpanded ? null : entry.cycle)}
                          className="text-xs text-brand hover:underline"
                        >
                          {isExpanded
                            ? 'Hide photos'
                            : `View ${cycleImages.length} photo${cycleImages.length > 1 ? 's' : ''} from this period`}
                        </button>
                        {isExpanded && (
                          <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                            {cycleImages.map((img, imgIdx) => (
                              <div
                                key={img.id}
                                className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden"
                              >
                                <img
                                  src={thumbnailUrl(img)}
                                  alt="Previous cycle"
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={() => openLightbox(cycleImages, imgIdx)}
                                />
                                {img.image_type === 'resolved' && (
                                  <span className="absolute bottom-0 left-0 right-0 bg-green-600 text-white text-center text-[8px] leading-tight py-0.5">
                                    Resolved
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-brand hover:text-brand transition"
                >
                  <span className="text-2xl mb-1">+</span>
                  <span className="text-xs">
                    {resolvePhotoPreviews.length > 0 ? 'Add more photos' : 'Click to upload photos'}
                  </span>
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
              {resolving ? (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm font-medium text-gray-600">
                    <span>{resolveLabel}</span>
                    <span>{resolveProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-brand h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${resolveProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-brand text-white font-semibold py-2.5 rounded-lg hover:bg-brand-dark transition"
                  >
                    Submit Resolution
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResolveForm(false)}
                    className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      )}

      {/* Resolved info + Reopen */}
      {report.status === 'cleaned' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-green-800 mb-1">Resolved</h2>
              <p className="text-sm text-green-700">This report has been marked as cleaned.</p>
            </div>
          </div>

          {!showReopenForm ? (
            <button
              onClick={() => setShowReopenForm(true)}
              className="w-full bg-orange-500 text-white font-semibold py-2.5 rounded-lg hover:bg-orange-600 transition text-sm"
            >
              Report still dirty? Reopen
            </button>
          ) : (
            <form onSubmit={handleUnresolve} className="mt-3 border-t border-green-200 pt-4">
              <p className="text-sm text-gray-600 mb-3">
                If this area is still dirty, you can reopen this report. Adding a photo is optional
                but helpful.
              </p>

              {/* Optional photo upload */}
              <div className="mb-4">
                <input
                  ref={reopenFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setReopenPhoto(file)
                    const reader = new FileReader()
                    reader.onloadend = () => setReopenPhotoPreview(reader.result as string)
                    reader.readAsDataURL(file)
                    if (reopenFileInputRef.current) reopenFileInputRef.current.value = ''
                  }}
                  className="hidden"
                />
                {reopenPhotoPreview ? (
                  <div className="relative inline-block">
                    <img
                      src={reopenPhotoPreview}
                      alt="Reopen proof"
                      className="w-32 h-24 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setReopenPhoto(null)
                        setReopenPhotoPreview(null)
                      }}
                      className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-opacity-70"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => reopenFileInputRef.current?.click()}
                    className="w-full h-16 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-orange-400 hover:text-orange-500 transition text-sm"
                  >
                    <span className="text-lg mb-0.5">+</span>
                    Add a photo (optional)
                  </button>
                )}
              </div>

              {reopening ? (
                <div className="text-center text-sm text-gray-500 py-2">Reopening...</div>
              ) : (
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-orange-500 text-white font-semibold py-2.5 rounded-lg hover:bg-orange-600 transition text-sm"
                  >
                    Reopen Report
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReopenForm(false)
                      setReopenPhoto(null)
                      setReopenPhotoPreview(null)
                    }}
                    className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition text-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </form>
          )}
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
      <div className="rounded-lg overflow-hidden shadow h-64 relative">
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
          <LocateButton />
        </MapContainer>
      </div>
    </div>
  )
}
