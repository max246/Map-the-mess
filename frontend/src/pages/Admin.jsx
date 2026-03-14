import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import api from '../api/client'
import { getReports } from '../api/endpoints/reports/reports'
import { useAuth } from '../context/AuthContext'

const { listReportsApiReportsGet } = getReports()

const PAGE_SIZE = 10

export default function Admin() {
  const { isLoggedIn, canManageUsers, user, token } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const fetchReports = () => {
    setLoading(true)
    listReportsApiReportsGet(statusFilter ? { status: statusFilter } : undefined)
      .then((data) => setReports(data))
      .catch(() => setReports([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchReports()
  }, [statusFilter])

  const handleDelete = async (reportId) => {
    if (!confirm(`Are you sure you want to delete report #${reportId}?`)) return
    setDeletingId(reportId)
    try {
      await api.delete(`/api/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setReports((prev) => prev.filter((r) => r.id !== reportId))
    } catch {
      alert('Failed to delete report.')
    } finally {
      setDeletingId(null)
    }
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />
  }

  if (!canManageUsers) {
    return <Navigate to="/volunteers" replace />
  }

  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(page, totalPages)
  const paginated = reports.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Logged in as <span className="font-medium text-gray-700">{user?.email}</span> &middot;{' '}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                user?.userType === 'superuser'
                  ? 'bg-red-100 text-red-700'
                  : user?.userType === 'admin'
                    ? 'bg-purple-100 text-purple-700'
                    : user?.userType === 'moderator'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
              }`}
            >
              {user?.userType?.charAt(0).toUpperCase() + user?.userType?.slice(1)}
            </span>
          </p>
        </div>
        {canManageUsers && (
          <Link
            to="/admin/users"
            className="bg-brand hover:bg-brand-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            Manage Users
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-500">Filter by status:</span>
        {['', 'pending', 'cleaned'].map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s)
              setPage(1)
            }}
            className={`text-sm px-3 py-1 rounded-full border transition ${
              statusFilter === s
                ? 'bg-brand text-white border-brand'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s === '' ? 'All' : s === 'cleaned' ? 'Cleaned' : 'Pending'}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-400">
          {reports.length} report{reports.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No reports found.
                </td>
              </tr>
            ) : (
              paginated.map((report) => (
                <tr key={report.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-700">#{report.id}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        report.status === 'cleaned'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {report.status === 'cleaned' ? 'Cleaned' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-gray-700">
                    {report.description || 'No description'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                    {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(report.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/report/${report.id}`}
                        className="text-brand hover:underline text-xs font-medium"
                      >
                        View
                      </Link>
                      {canManageUsers && (
                        <button
                          onClick={() => handleDelete(report.id)}
                          disabled={deletingId === report.id}
                          className="text-red-500 hover:text-red-700 text-xs font-medium hover:underline disabled:opacity-50"
                        >
                          {deletingId === report.id ? 'Deleting...' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safeCurrentPage === 1}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-30 hover:bg-gray-50 transition"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 rounded text-sm transition ${
                p === safeCurrentPage
                  ? 'bg-brand text-white'
                  : 'border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safeCurrentPage === totalPages}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-30 hover:bg-gray-50 transition"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
