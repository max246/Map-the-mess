import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { getReports } from '../api/endpoints/reports/reports'
import { useAuth } from '../context/AuthContext'
import { thumbnailUrl } from '../api/client'

const { listReportsApiReportsGet } = getReports()

export default function VolunteerDashboard() {
  const { isLoggedIn, user } = useAuth()
  const [tab, setTab] = useState('planned')
  const [pendingReports, setPendingReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (tab === 'unresolved') {
      setLoading(true)
      listReportsApiReportsGet({ status: 'pending' })
        .then((data) => setPendingReports(data))
        .catch(() => setPendingReports([]))
        .finally(() => setLoading(false))
    }
  }, [tab])

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Volunteer Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">
        Welcome back, <span className="font-medium text-gray-700">{user?.email}</span>
      </p>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setTab('planned')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
            tab === 'planned'
              ? 'border-brand text-brand'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          My Planned Cleanups
        </button>
        <button
          onClick={() => setTab('unresolved')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
            tab === 'unresolved'
              ? 'border-brand text-brand'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Unresolved Reports
        </button>
      </div>

      {/* Planned tab */}
      {tab === 'planned' && (
        <div>
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">
            <p className="text-4xl mb-3">🧹</p>
            <p className="mb-1">No planned cleanups yet.</p>
            <p className="text-sm">
              Browse the{' '}
              <button onClick={() => setTab('unresolved')} className="text-brand underline">
                unresolved reports
              </button>{' '}
              or head to the{' '}
              <Link to="/map" className="text-brand underline">
                map
              </Link>{' '}
              to find litter near you.
            </p>
          </div>
        </div>
      )}

      {/* Unresolved tab */}
      {tab === 'unresolved' && (
        <div>
          {loading ? (
            <p className="text-center text-gray-400 py-8">Loading...</p>
          ) : pendingReports.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">
              <p className="text-4xl mb-3">🎉</p>
              <p>No unresolved reports. The community is looking clean!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingReports.map((report) => {
                const firstImage = report.images?.find((img) => img.image_type === 'report')
                return (
                  <Link
                    key={report.id}
                    to={`/report/${report.id}`}
                    className="bg-white rounded-lg shadow hover:shadow-md transition flex overflow-hidden"
                  >
                    {/* Thumbnail */}
                    <div className="w-24 h-24 flex-shrink-0 bg-gray-100">
                      {firstImage ? (
                        <img
                          src={thumbnailUrl(firstImage)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">
                          📷
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-3 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Pending
                        </span>
                        <span className="text-xs text-gray-400">#{report.id}</span>
                      </div>
                      <p className="text-sm text-gray-700 truncate">
                        {report.description || 'No description'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(report.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {report.what3words && (
                          <span className="ml-2 text-brand">/// {report.what3words}</span>
                        )}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
