import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import { getCommunities } from '../api/endpoints/communities/communities'
import { useAuth } from '../context/AuthContext'
import MarkdownRenderer from '../components/MarkdownRenderer'
import type { CommunityDetail, PostRead } from '../api/model'

const {
  getCommunityApiCommunitiesCommunityIdGet,
  createPostApiCommunitiesCommunityIdPostsPost,
  updatePostApiCommunitiesCommunityIdPostsPostIdPatch,
  deletePostApiCommunitiesCommunityIdPostsPostIdDelete,
} = getCommunities()

export default function PostDetail() {
  const { id: communityId, postId } = useParams<{ id: string; postId: string }>() as {
    id: string
    postId: string
  }
  const isNew = postId === 'new'
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, canManageUsers } = useAuth()
  const navigate = useNavigate()

  const [community, setCommunity] = useState<CommunityDetail | null>(null)
  const [post, setPost] = useState<PostRead | null>(null)
  const [loading, setLoading] = useState(!isNew)

  // Editor state
  const [editing, setEditing] = useState(isNew || searchParams.get('edit') === 'true')
  const [editContent, setEditContent] = useState('')
  const [editTab, setEditTab] = useState<'write' | 'preview'>('write')
  const [saving, setSaving] = useState(false)

  // Reset editing state when postId changes (e.g. after creating a new post)
  const [prevPostId, setPrevPostId] = useState(postId)
  if (postId !== prevPostId) {
    setPrevPostId(postId)
    setEditing(isNew || searchParams.get('edit') === 'true')
  }

  const isOwner = !!(user && community && user.id === community.owner_id)

  useEffect(() => {
    getCommunityApiCommunitiesCommunityIdGet(communityId)
      .then((c) => {
        setCommunity(c)
        if (!isNew) {
          const found = c.posts?.find((p) => p.id === postId)
          setPost(found || null)
          if (found && searchParams.get('edit') === 'true') {
            setEditContent(found.content)
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [communityId, postId, isNew, searchParams])

  const startEdit = () => {
    if (!post) return
    setEditContent(post.content)
    setEditTab('write')
    setEditing(true)
    setSearchParams({ edit: 'true' })
  }

  const cancelEdit = () => {
    if (isNew) {
      navigate(`/communities/${communityId}`)
    } else {
      setEditing(false)
      setSearchParams({})
    }
  }

  const handleSave = async () => {
    if (!editContent.trim()) return
    setSaving(true)
    try {
      if (isNew) {
        const created = await createPostApiCommunitiesCommunityIdPostsPost(communityId, {
          content: editContent,
        })
        setEditing(false)
        navigate(`/communities/${communityId}/posts/${created.id}`)
      } else {
        const updated = await updatePostApiCommunitiesCommunityIdPostsPostIdPatch(
          communityId,
          postId!,
          { content: editContent }
        )
        setPost(updated)
        setEditing(false)
        setSearchParams({})
      }
    } catch {
      alert(isNew ? 'Failed to create post' : 'Failed to update post')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this post?')) return
    try {
      await deletePostApiCommunitiesCommunityIdPostsPostIdDelete(communityId, postId!)
      navigate(`/communities/${communityId}`)
    } catch {
      alert('Failed to delete post')
    }
  }

  if (loading) return <div className="text-center text-gray-400 py-16">Loading...</div>
  if (!isNew && (!post || !community))
    return <div className="text-center text-gray-500 py-16">Post not found</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <PageMeta title="Post" description="View and discuss community posts." />
      <Link
        to={`/communities/${communityId}`}
        className="text-sm text-brand underline mb-4 inline-block"
      >
        ← Back to {community?.name || 'community'}
      </Link>

      {isNew && <h1 className="text-2xl font-bold mb-4">New Post</h1>}

      <div className="bg-white rounded-lg shadow p-6">
        {editing ? (
          <>
            {/* Write / Preview tabs */}
            <div className="flex items-center border-b border-gray-200 mb-3">
              <button
                onClick={() => setEditTab('write')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
                  editTab === 'write'
                    ? 'border-brand text-brand'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Write
              </button>
              <button
                onClick={() => setEditTab('preview')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
                  editTab === 'preview'
                    ? 'border-brand text-brand'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Preview
              </button>
              <span className="ml-auto text-xs text-gray-400">Supports Markdown formatting</span>
            </div>
            {editTab === 'write' ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={14}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono mb-1"
                placeholder="# Your title&#10;&#10;Write your post here using **Markdown**...&#10;&#10;- Use **bold** or *italic*&#10;- Add [links](https://example.com)&#10;- Create lists with - or 1."
              />
            ) : (
              <div className="border border-gray-200 rounded-lg px-4 py-3 bg-gray-50 min-h-[20rem] overflow-auto text-sm mb-1">
                {editContent.trim() ? (
                  <MarkdownRenderer content={editContent} />
                ) : (
                  <p className="text-gray-300 italic">Nothing to preview</p>
                )}
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSave}
                disabled={saving || !editContent.trim()}
                className="bg-brand text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : isNew ? 'Publish Post' : 'Save changes'}
              </button>
              <button
                onClick={cancelEdit}
                className="px-4 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          post && <MarkdownRenderer content={post.content} />
        )}

        {!editing && post && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            <span className="text-sm text-gray-400">
              {new Date(post.created_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            {(isOwner || canManageUsers) && (
              <div className="flex gap-2">
                {isOwner && (
                  <button
                    onClick={startEdit}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border border-red-300 text-red-700 hover:bg-red-50 transition"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
