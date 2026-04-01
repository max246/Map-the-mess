import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import { getCommunities } from '../api/endpoints/communities/communities'
import { useAuth } from '../context/AuthContext'
import { communityImageUrl } from '../api/client'
import type { CommunityRead } from '../api/model'

const {
  listCommunitiesApiCommunitiesGet,
  updateCommunityStatusApiCommunitiesCommunityIdStatusPatch,
  deleteCommunityApiCommunitiesCommunityIdDelete,
} = getCommunities()

const PAGE_SIZE = 15

export default function AdminCommunities() {
  const { isLoggedIn, canManageUsers, isAdmin } = useAuth()
  const [communities, setCommunities] = useState<CommunityRead[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchCommunities = () => {
    setLoading(true)
    listCommunitiesApiCommunitiesGet(search.trim() ? { search: search.trim() } : undefined)
      .then(setCommunities)
      .catch(() => setCommunities([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchCommunities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = () => {
    setPage(1)
    fetchCommunities()
  }

  const handleToggleStatus = async (community: CommunityRead) => {
    const newStatus = community.status === 'active' ? 'under_review' : 'active'
    setActionId(community.id)
    try {
      await updateCommunityStatusApiCommunitiesCommunityIdStatusPatch(community.id, {
        status: newStatus,
      })
      setCommunities((prev) =>
        prev.map((c) => (c.id === community.id ? { ...c, status: newStatus } : c))
      )
    } catch {
      alert('Failed to update status')
    }
    setActionId(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete community #${id}? This cannot be undone.`)) return
    setActionId(id)
    try {
      await deleteCommunityApiCommunitiesCommunityIdDelete(id)
      setCommunities((prev) => prev.filter((c) => c.id !== id))
    } catch {
      alert('Failed to delete community')
    }
    setActionId(null)
  }

  if (!isLoggedIn) return <Navigate to="/login" replace />
  if (!canManageUsers) return <Navigate to="/" replace />

  const filtered = statusFilter ? communities.filter((c) => c.status === statusFilter) : communities
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <PageMeta title="Manage Communities" description="Review and manage community groups." />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Manage Communities</h1>
          <Link to="/admin" className="text-sm text-brand hover:underline">
            ← Back to admin
          </Link>
        </div>
        <span className="text-sm text-gray-400">
          {communities.length} communit{communities.length !== 1 ? 'ies' : 'y'} total
        </span>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by name..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={handleSearch}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          Search
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-500">Status:</span>
        {[
          { value: '', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'under_review', label: 'Under Review' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setStatusFilter(f.value)
              setPage(1)
            }}
            className={`text-sm px-3 py-1 rounded-full border transition ${
              statusFilter === f.value
                ? 'bg-brand text-white border-brand'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-400">{filtered.length} shown</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">Community</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Radius</th>
              <th className="px-4 py-3 font-medium">Created</th>
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
                  No communities found.
                </td>
              </tr>
            ) : (
              paginated.map((c) => (
                <tr key={c.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {c.profile_image ? (
                        <img
                          src={communityImageUrl(c.profile_image)}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm flex-shrink-0">
                          🏘️
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link
                          to={`/communities/${c.id}`}
                          className="font-medium truncate hover:text-brand transition block"
                        >
                          {c.name}
                        </Link>
                        <p className="text-xs text-gray-400 truncate max-w-xs">
                          {c.description || 'No description'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {c.status === 'active' ? 'Active' : 'Under Review'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">#{c.owner_id}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.radius_km} km</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(c.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {canManageUsers && (
                        <button
                          onClick={() => handleToggleStatus(c)}
                          disabled={actionId === c.id}
                          className={`text-xs font-medium hover:underline disabled:opacity-50 ${
                            c.status === 'active'
                              ? 'text-yellow-600 hover:text-yellow-700'
                              : 'text-green-600 hover:text-green-700'
                          }`}
                        >
                          {c.status === 'active' ? 'Review' : 'Activate'}
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={actionId === c.id}
                          className="text-red-500 hover:text-red-700 text-xs font-medium hover:underline disabled:opacity-50"
                        >
                          Delete
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
