import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { getReports } from '../api/endpoints/reports/reports'
import { getVolunteers } from '../api/endpoints/volunteers/volunteers'
import { useAuth } from '../context/AuthContext'
import { thumbnailUrl } from '../api/client'
import type { ReportRead } from '../api/model'

const { listReportsApiReportsGet } = getReports()
const {
  listFavouritesApiVolunteersFavouritesGet,
  addFavouriteApiVolunteersFavouritesReportIdPost,
  removeFavouriteApiVolunteersFavouritesReportIdDelete,
} = getVolunteers()

type Tab = 'favourites' | 'unresolved' | 'resolved'

function ReportCard({
  report,
  isFavourite,
  onToggleFavourite,
}: {
  report: ReportRead
  isFavourite: boolean
  onToggleFavourite: (id: number, starred: boolean) => void
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

export default function VolunteerDashboard() {
  const { isLoggedIn, user } = useAuth()
  const [tab, setTab] = useState<Tab>('favourites')
  const [favourites, setFavourites] = useState<ReportRead[]>([])
  const [favouriteIds, setFavouriteIds] = useState<Set<number>>(new Set())
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

  const handleToggleFavourite = async (reportId: number, star: boolean) => {
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
      <h1 className="text-2xl font-bold mb-1">Volunteer Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">
        Welcome back, <span className="font-medium text-gray-700">{user?.email}</span>
      </p>

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
