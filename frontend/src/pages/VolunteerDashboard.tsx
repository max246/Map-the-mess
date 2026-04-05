import { useState, useEffect, useRef } from 'react'
import { Link, Navigate } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import CityAutocomplete from '../components/CityAutocomplete'
import { getAuth } from '../api/endpoints/auth/auth'
import { getReports } from '../api/endpoints/reports/reports'
import { getVolunteers } from '../api/endpoints/volunteers/volunteers'
import { useAuth } from '../context/AuthContext'
import { thumbnailUrl } from '../api/client'
import type { ReportRead, BadgeRead } from '../api/model'

const {
  getProfileApiAuthMeGet,
  updateProfileApiAuthMePatch,
  uploadAvatarApiAuthMeAvatarPut,
  changePasswordApiAuthMePasswordPatch,
} = getAuth()
const { listReportsApiReportsGet } = getReports()
const {
  listFavouritesApiVolunteersFavouritesGet,
  addFavouriteApiVolunteersFavouritesReportIdPost,
  removeFavouriteApiVolunteersFavouritesReportIdDelete,
} = getVolunteers()

const WOMBLE_AVATARS = [
  '/avatars/womble1.png',
  '/avatars/womble2.png',
  '/avatars/womble3.png',
  '/avatars/womble4.png',
]

type Tab = 'favourites' | 'unresolved' | 'resolved'

function ReportCard({
  report,
  isFavourite,
  onToggleFavourite,
}: {
  report: ReportRead
  isFavourite: boolean
  onToggleFavourite: (id: string, starred: boolean) => void
}) {
  const firstImage = report.images?.find((img) => img.image_type === 'report')
  const isCleaned = report.status === 'cleaned'

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition flex overflow-hidden">
      <Link to={`/report/${report.id}`} className="flex flex-1 min-w-0">
        {/* Thumbnail */}
        <div className="w-24 h-24 flex-shrink-0 bg-gray-100">
          {firstImage ? (
            <img src={thumbnailUrl(firstImage)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">
              📷
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                isCleaned ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {isCleaned ? 'Cleaned' : 'Pending'}
            </span>
            <span className="text-xs text-gray-400">#{report.id}</span>
          </div>
          <p className="text-sm text-gray-700 truncate">{report.description || 'No description'}</p>
          <p className="text-xs text-gray-400 mt-1">
            {new Date(report.created_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            {report.what3words && <span className="ml-2 text-brand">/// {report.what3words}</span>}
          </p>
        </div>
      </Link>

      <button
        onClick={() => onToggleFavourite(report.id, !isFavourite)}
        className={`px-3 flex items-center text-xl transition ${
          isFavourite
            ? 'text-yellow-500 hover:text-yellow-600'
            : 'text-gray-300 hover:text-yellow-400'
        }`}
        title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
      >
        {isFavourite ? '★' : '☆'}
      </button>
    </div>
  )
}

/** Resolve an avatar_url to a displayable src.
 *  - Womble paths like "/avatars/womble1.png" are served by the frontend.
 *  - Custom uploaded filenames like "avatar_abc123.jpg" are served by the backend images endpoint.
 */
function avatarSrc(avatarUrl: string | null | undefined): string {
  if (!avatarUrl) return WOMBLE_AVATARS[0]
  if (avatarUrl.startsWith('/avatars/')) return avatarUrl
  // Custom upload — served from backend images
  return `/api/reports/images/${avatarUrl}`
}

function ProfileSection() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [avatar, setAvatar] = useState(WOMBLE_AVATARS[0])
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)

  // Edit name
  const [editingName, setEditingName] = useState(false)
  const [fullName, setFullName] = useState('')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameMsg, setNameMsg] = useState('')

  // City / location
  const [cityName, setCityName] = useState('')
  const [cityLoading, setCityLoading] = useState(false)
  const [cityMsg, setCityMsg] = useState('')
  const [editingCity, setEditingCity] = useState(false)

  // Badges
  const [badges, setBadges] = useState<BadgeRead[]>([])

  // Change password
  const [editingPassword, setEditingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState('')

  // Load profile from backend
  useEffect(() => {
    getProfileApiAuthMeGet()
      .then((profile) => {
        setFullName(profile.full_name || '')
        setAvatar(avatarSrc(profile.avatar_url))
        setBadges(profile.badges || [])
        // Reverse-geocode to show current city name
        if (
          profile.city_latitude &&
          profile.city_longitude &&
          !(profile.city_latitude === 0 && profile.city_longitude === 0)
        ) {
          fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${profile.city_latitude}&lon=${profile.city_longitude}&format=json&zoom=10`
          )
            .then((r) => r.json())
            .then((data) => {
              const addr = data.address
              const name =
                addr?.city || addr?.town || addr?.village || addr?.municipality || data.display_name
              if (name) setCityName(name)
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
  }, [])

  const handleCitySelect = async (displayName: string, lat: number, lon: number) => {
    setCityLoading(true)
    setCityMsg('')
    try {
      await updateProfileApiAuthMePatch({
        city_latitude: lat,
        city_longitude: lon,
      })
      setCityName(displayName)
      setCityMsg('Location updated!')
      setEditingCity(false)
    } catch {
      setCityMsg('Failed to update location.')
    }
    setCityLoading(false)
  }

  const handleAvatarSelect = async (src: string) => {
    // Womble avatar — store the path in DB via PATCH /me
    setAvatar(src)
    setShowAvatarPicker(false)
    try {
      await updateProfileApiAuthMePatch({ avatar_url: src })
    } catch {
      // silently fail — avatar is already set visually
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setShowAvatarPicker(false)
    try {
      const result = await uploadAvatarApiAuthMeAvatarPut({ file })
      setAvatar(avatarSrc(result.avatar_url))
    } catch {
      alert('Failed to upload avatar.')
    }
  }

  const handleSaveName = async () => {
    setNameMsg('')
    setNameLoading(true)
    try {
      await updateProfileApiAuthMePatch({ full_name: fullName.trim() })
      setNameMsg('Name updated!')
      setEditingName(false)
    } catch {
      setNameMsg('Failed to update name. Please try again later.')
    }
    setNameLoading(false)
  }

  const handleChangePassword = async () => {
    setPwMsg('')
    if (newPassword.length < 6) {
      setPwMsg('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMsg('Passwords do not match.')
      return
    }
    setPwLoading(true)
    try {
      await changePasswordApiAuthMePasswordPatch({
        current_password: currentPassword,
        new_password: newPassword,
      })
      setPwMsg('Password changed!')
      setEditingPassword(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setPwMsg('Failed to change password. Please try again later.')
    }
    setPwLoading(false)
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-start gap-6">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="relative group">
            <img
              src={avatar}
              alt="Avatar"
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
            />
            <button
              onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-medium"
            >
              Change
            </button>
          </div>

          {showAvatarPicker && (
            <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-56">
              <p className="text-xs font-medium text-gray-500 mb-2">Pick an avatar</p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {WOMBLE_AVATARS.map((src) => (
                  <button
                    key={src}
                    onClick={() => handleAvatarSelect(src)}
                    className={`rounded-full overflow-hidden border-2 transition ${
                      avatar === src ? 'border-brand' : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <img src={src} alt="" className="w-10 h-10 object-cover" />
                  </button>
                ))}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full text-xs text-brand hover:underline text-center"
              >
                Upload custom picture
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500">{user?.email}</p>

          {/* Name */}
          <div className="mt-2">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1"
                  placeholder="Your full name"
                />
                <button
                  onClick={handleSaveName}
                  disabled={nameLoading || !fullName.trim()}
                  className="px-3 py-1.5 bg-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  {nameLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingName(false)
                    setNameMsg('')
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">{fullName || 'No name set'}</p>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-xs text-brand hover:underline"
                >
                  Edit
                </button>
              </div>
            )}
            {nameMsg && (
              <p
                className={`text-xs mt-1 ${nameMsg.includes('Failed') ? 'text-red-500' : 'text-green-600'}`}
              >
                {nameMsg}
              </p>
            )}
          </div>

          {/* City / Location */}
          <div className="mt-3">
            {editingCity ? (
              <div className="max-w-sm">
                <CityAutocomplete
                  onSelect={handleCitySelect}
                  onCancel={() => {
                    setEditingCity(false)
                    setCityMsg('')
                  }}
                />
                {cityLoading && <p className="text-xs text-gray-400 mt-1">Saving...</p>}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{cityName || 'No location set'}</span>
                <button
                  onClick={() => setEditingCity(true)}
                  className="text-xs text-brand hover:underline"
                >
                  {cityName ? 'Change' : 'Set location'}
                </button>
              </div>
            )}
            {cityMsg && (
              <p
                className={`text-xs mt-1 ${cityMsg.includes('Failed') ? 'text-red-500' : 'text-green-600'}`}
              >
                {cityMsg}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="mt-3">
            {editingPassword ? (
              <div className="space-y-2 max-w-sm">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  placeholder="Current password"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  placeholder="New password (min 6 characters)"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  placeholder="Confirm new password"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleChangePassword}
                    disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
                    className="px-3 py-1.5 bg-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
                  >
                    {pwLoading ? 'Changing...' : 'Change Password'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingPassword(false)
                      setPwMsg('')
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditingPassword(true)}
                className="text-xs text-brand hover:underline"
              >
                Change password
              </button>
            )}
            {pwMsg && (
              <p
                className={`text-xs mt-1 ${pwMsg.includes('Failed') || pwMsg.includes('must') || pwMsg.includes('match') ? 'text-red-500' : 'text-green-600'}`}
              >
                {pwMsg}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="mt-6 pt-5 border-t border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Badges</h3>
        {badges.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {badges.map((badge) => (
              <div key={badge.id} className="flex flex-col items-center gap-1.5">
                <img
                  src={`/badges/thumbs/${badge.id}.jpg`}
                  alt={badge.name}
                  title={badge.description}
                  className="w-[150px] h-[150px] object-contain"
                />
                <span className="text-sm text-gray-600 text-center leading-tight font-medium">
                  {badge.name}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No badges yet — keep volunteering!</p>
        )}
      </div>
    </div>
  )
}

export default function VolunteerDashboard() {
  const { isLoggedIn, user } = useAuth()
  const [tab, setTab] = useState<Tab>('favourites')
  const [favourites, setFavourites] = useState<ReportRead[]>([])
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set())
  const [reports, setReports] = useState<ReportRead[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFavourites = () => {
    setLoading(true)
    listFavouritesApiVolunteersFavouritesGet()
      .then((data) => {
        setFavourites(data)
        setFavouriteIds(new Set(data.map((r) => r.id)))
      })
      .catch(() => {
        setFavourites([])
        setFavouriteIds(new Set())
      })
      .finally(() => setLoading(false))
  }

  const fetchReports = (status: string) => {
    setLoading(true)
    listReportsApiReportsGet({ status })
      .then((data) => setReports(data))
      .catch(() => setReports([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    // Always fetch favourite IDs so stars work on all tabs
    listFavouritesApiVolunteersFavouritesGet()
      .then((data) => setFavouriteIds(new Set(data.map((r) => r.id))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (tab === 'favourites') {
      fetchFavourites()
    } else if (tab === 'unresolved') {
      fetchReports('pending')
    } else if (tab === 'resolved') {
      fetchReports('cleaned')
    }
  }, [tab])

  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)

  // Reset page when switching tabs
  useEffect(() => {
    setPage(1)
  }, [tab])

  const handleToggleFavourite = async (reportId: string, star: boolean) => {
    try {
      if (star) {
        await addFavouriteApiVolunteersFavouritesReportIdPost(reportId)
        setFavouriteIds((prev) => new Set([...prev, reportId]))
      } else {
        await removeFavouriteApiVolunteersFavouritesReportIdDelete(reportId)
        setFavouriteIds((prev) => {
          const next = new Set(prev)
          next.delete(reportId)
          return next
        })
        if (tab === 'favourites') {
          setFavourites((prev) => prev.filter((r) => r.id !== reportId))
        }
      }
    } catch {
      alert('Failed to update favourite.')
    }
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'favourites', label: 'My Favourites' },
    { key: 'unresolved', label: 'Unresolved Reports' },
    { key: 'resolved', label: 'Resolved Reports' },
  ]

  const displayedReports = tab === 'favourites' ? favourites : reports
  const totalPages = Math.max(1, Math.ceil(displayedReports.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = displayedReports.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <PageMeta
        title="Volunteer Dashboard"
        description="Manage your volunteer profile, view your reports, and track your litter-picking progress."
      />
      <h1 className="text-2xl font-bold mb-6">Volunteer Dashboard</h1>

      {/* Profile Section */}
      <ProfileSection />

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              tab === t.key
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-center text-gray-400 py-8">Loading...</p>
      ) : paginated.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">
          <p className="text-4xl mb-3">
            {tab === 'favourites' ? '⭐' : tab === 'unresolved' ? '🎉' : '📋'}
          </p>
          <p>
            {tab === 'favourites' ? (
              <>
                No favourites yet. Star reports from the{' '}
                <button onClick={() => setTab('unresolved')} className="text-brand underline">
                  unresolved reports
                </button>{' '}
                or from the{' '}
                <Link to="/map" className="text-brand underline">
                  map
                </Link>{' '}
                to plan your cleanups.
              </>
            ) : tab === 'unresolved' ? (
              'No unresolved reports. The community is looking clean!'
            ) : (
              'No resolved reports yet.'
            )}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {paginated.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              isFavourite={favouriteIds.has(report.id)}
              onToggleFavourite={handleToggleFavourite}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-30 hover:bg-gray-50 transition"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            {safePage} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-30 hover:bg-gray-50 transition"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
