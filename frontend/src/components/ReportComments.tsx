import { useState, useEffect, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { getReports } from '../api/endpoints/reports/reports'
import type { ReportCommentRead } from '../api/model'

const {
  listCommentsApiReportsReportIdCommentsGet,
  addCommentApiReportsReportIdCommentsPost,
  deleteCommentApiReportsReportIdCommentsCommentIdDelete,
} = getReports()

const PAGE_SIZE = 4

interface Props {
  reportId: string
  reportStatus: string
  reportOwnerId?: string | null
}

export default function ReportComments({ reportId, reportStatus, reportOwnerId }: Props) {
  const { user, isLoggedIn, canManageUsers } = useAuth()

  const [comments, setComments] = useState<ReportCommentRead[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isOpen = reportStatus === 'pending'

  const fetchComments = () => {
    setLoading(true)
    listCommentsApiReportsReportIdCommentsGet(reportId)
      .then((data) => setComments([...data].reverse()))
      .catch(() => setComments([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId])

  const totalPages = Math.max(1, Math.ceil(comments.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = comments.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    try {
      await addCommentApiReportsReportIdCommentsPost(reportId, { body: body.trim() })
      setBody('')
      fetchComments()
      setPage(1)
    } catch {
      alert('Failed to add comment.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return
    setDeletingId(commentId)
    try {
      await deleteCommentApiReportsReportIdCommentsCommentIdDelete(reportId, commentId)
      fetchComments()
    } catch {
      alert('Failed to delete comment.')
    } finally {
      setDeletingId(null)
    }
  }

  const canDelete = (comment: ReportCommentRead) =>
    canManageUsers || (!!user && user.id === comment.user_id)

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="bg-white rounded-lg shadow p-5 mb-6">
      <h2 className="font-semibold mb-3 text-gray-700">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h2>

      {loading ? (
        <p className="text-sm text-gray-400">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400">No comments yet.</p>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((c) => (
              <div key={c.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words flex-1">
                    {c.body}
                  </p>
                  {canDelete(c) && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      className="text-red-400 hover:text-red-600 text-xs shrink-0 transition disabled:opacity-50"
                      title="Delete comment"
                    >
                      {deletingId === c.id ? '...' : 'Delete'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">{formatDate(c.created_at)}</p>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-30 hover:bg-gray-50 transition"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 rounded text-sm transition ${
                    p === safePage
                      ? 'bg-brand text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-30 hover:bg-gray-50 transition"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Add comment form — only for logged-in users on open reports */}
      {isLoggedIn && isOpen && (
        <form onSubmit={handleSubmit} className="mt-4 border-t border-gray-100 pt-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment..."
            rows={3}
            maxLength={1000}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">{body.length}/1000</span>
            <button
              type="submit"
              disabled={submitting || !body.trim()}
              className="bg-brand text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-dark transition disabled:opacity-50"
            >
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>
      )}

      {!isLoggedIn && isOpen && (
        <p className="text-sm text-gray-400 mt-4 border-t border-gray-100 pt-4">
          Log in to leave a comment.
        </p>
      )}
    </div>
  )
}
