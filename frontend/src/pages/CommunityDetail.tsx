import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getCommunities } from '../api/endpoints/communities/communities'
import { useAuth } from '../context/AuthContext'
import { communityImageUrl } from '../api/client'
import MarkdownRenderer from '../components/MarkdownRenderer'
import type {
  CommunityDetail as CommunityDetailType,
  PostRead,
  EventRead,
  MembershipRead,
} from '../api/model'

const {
  getCommunityApiCommunitiesCommunityIdGet,
  uploadProfileImageApiCommunitiesCommunityIdImagePut,
  updateCommunityStatusApiCommunitiesCommunityIdStatusPatch,
  deleteCommunityApiCommunitiesCommunityIdDelete,
  deletePostApiCommunitiesCommunityIdPostsPostIdDelete,
  deleteEventApiCommunitiesCommunityIdEventsEventIdDelete,
  joinCommunityApiCommunitiesCommunityIdJoinPost,
  leaveCommunityApiCommunitiesCommunityIdLeaveDelete,
  listMembershipsApiCommunitiesCommunityIdMembershipsGet,
  updateMembershipApiCommunitiesCommunityIdMembershipsMembershipIdPatch,
  myCommunitiesApiCommunitiesMineGet,
} = getCommunities()

export default function CommunityDetail() {
  const { id } = useParams<{ id: string }>()
  const communityId = Number(id)
  const { user, isLoggedIn, isAdmin, canManageUsers } = useAuth()
  const navigate = useNavigate()

  const [community, setCommunity] = useState<CommunityDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Membership
  const [memberships, setMemberships] = useState<MembershipRead[]>([])
  const [myMembership, setMyMembership] = useState<MembershipRead | null>(null)
  const [joining, setJoining] = useState(false)

  // Image upload
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isOwner = !!(user && community && user.id === community.owner_id)

  useEffect(() => {
    setLoading(true)
    getCommunityApiCommunitiesCommunityIdGet(communityId)
      .then(setCommunity)
      .catch(() => setError('Community not found'))
      .finally(() => setLoading(false))
  }, [communityId])

  // Fetch memberships + own status
  const fetchMemberships = () => {
    if (!isLoggedIn) return
    // Only owner/admin can list memberships
    if (isOwner || isAdmin) {
      listMembershipsApiCommunitiesCommunityIdMembershipsGet(communityId)
        .then((mems) => {
          setMemberships(mems)
          if (user) {
            const mine = mems.find((m) => m.user_id === user.id)
            if (mine) setMyMembership(mine)
          }
        })
        .catch(() => {})
    }
    // Also check /mine to get the user's own pending/joined status
    // (since non-owners can't see pending memberships in the list)
    myCommunitiesApiCommunitiesMineGet()
      .then((data) => {
        const joinedIds = new Set((data.joined || []).map((c) => c.id))
        const pendingIds = new Set((data.pending || []).map((c) => c.id))
        const rejectedEntry = (data.rejected || []).find((r) => r.community.id === communityId)
        if (joinedIds.has(communityId)) {
          setMyMembership(
            (prev) =>
              prev || {
                id: 0,
                community_id: communityId,
                user_id: user?.id || 0,
                user_name: '',
                status: 'approved',
                created_at: '',
              }
          )
        } else if (pendingIds.has(communityId)) {
          setMyMembership(
            (prev) =>
              prev || {
                id: 0,
                community_id: communityId,
                user_id: user?.id || 0,
                user_name: '',
                status: 'pending',
                created_at: '',
              }
          )
        } else if (rejectedEntry) {
          setMyMembership(
            (prev) =>
              prev || {
                id: 0,
                community_id: communityId,
                user_id: user?.id || 0,
                user_name: '',
                status: 'rejected',
                created_at: '',
                updated_at: rejectedEntry.rejected_at || '',
              }
          )
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchMemberships()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, isLoggedIn, user, community?.owner_id])

  const refresh = () => {
    getCommunityApiCommunitiesCommunityIdGet(communityId).then(setCommunity).catch(console.error)
    fetchMemberships()
  }

  // --- Image upload ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const updated = await uploadProfileImageApiCommunitiesCommunityIdImagePut(communityId, {
        file,
      })
      setCommunity((prev) => (prev ? { ...prev, profile_image: updated.profile_image } : prev))
    } catch {
      alert('Failed to upload image')
    }
  }

  // --- Status toggle ---
  const handleStatusToggle = async () => {
    if (!community) return
    const newStatus = community.status === 'active' ? 'under_review' : 'active'
    try {
      await updateCommunityStatusApiCommunitiesCommunityIdStatusPatch(communityId, {
        status: newStatus,
      })
      setCommunity((prev) => (prev ? { ...prev, status: newStatus } : prev))
    } catch {
      alert('Failed to update status')
    }
  }

  // --- Delete community ---
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this community? This cannot be undone.')) return
    try {
      await deleteCommunityApiCommunitiesCommunityIdDelete(communityId)
      navigate('/communities')
    } catch {
      alert('Failed to delete community')
    }
  }

  // --- Posts ---

  const handleDeletePost = async (postId: number) => {
    if (!confirm('Delete this post?')) return
    try {
      await deletePostApiCommunitiesCommunityIdPostsPostIdDelete(communityId, postId)
      setCommunity((prev) =>
        prev ? { ...prev, posts: (prev.posts || []).filter((p) => p.id !== postId) } : prev
      )
    } catch {
      alert('Failed to delete post')
    }
  }

  // --- Events ---
  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm('Delete this event?')) return
    try {
      await deleteEventApiCommunitiesCommunityIdEventsEventIdDelete(communityId, eventId)
      setCommunity((prev) =>
        prev ? { ...prev, events: (prev.events || []).filter((e) => e.id !== eventId) } : prev
      )
    } catch {
      alert('Failed to delete event')
    }
  }

  if (loading) return <div className="text-center text-gray-400 py-16">Loading...</div>
  if (error || !community)
    return <div className="text-center text-gray-500 py-16">{error || 'Not found'}</div>

  const isUnderReview = community.status === 'under_review'
  const pendingCount = memberships.filter((m) => m.status === 'pending').length
  const posts = [...(community.posts || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const events = [...(community.events || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/communities" className="text-sm text-brand underline mb-4 inline-block">
        ← Back to communities
      </Link>

      {/* Pending approval banner (owner only) */}
      {isOwner && pendingCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
          <span className="text-red-500 text-lg">!</span>
          <p className="text-red-700 text-sm">
            <span className="font-medium">{pendingCount}</span> membership{' '}
            {pendingCount === 1 ? 'request' : 'requests'} pending approval.{' '}
            <a
              href="#members"
              className="underline"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('pending-requests')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Review now
            </a>
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="relative flex-shrink-0">
          {community.profile_image ? (
            <img
              src={communityImageUrl(community.profile_image)}
              alt={community.name}
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-3xl">
              🏘️
            </div>
          )}
          {isOwner && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow border border-gray-200 text-xs"
                title="Change image"
              >
                📷
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleImageUpload}
                className="hidden"
              />
            </>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{community.name}</h1>
            {isUnderReview && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                Under review
              </span>
            )}
          </div>
          {community.description && <p className="text-gray-600 mt-1">{community.description}</p>}
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
            <span>{community.radius_km} km radius</span>
            {community.facebook_url && (
              <a
                href={community.facebook_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline"
              >
                Facebook page
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Join / Leave / Pending */}
      {isLoggedIn && !isOwner && (
        <div className="mb-6">
          {!myMembership ? (
            <button
              onClick={async () => {
                setJoining(true)
                try {
                  const membership =
                    await joinCommunityApiCommunitiesCommunityIdJoinPost(communityId)
                  setMyMembership(membership)
                } catch (err: unknown) {
                  const detail = (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail
                  alert(detail || 'Failed to join community')
                }
                setJoining(false)
              }}
              disabled={joining}
              className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {joining ? 'Requesting...' : 'Join Community'}
            </button>
          ) : myMembership.status === 'pending' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
              Pending approval
            </span>
          ) : myMembership.status === 'approved' ? (
            <button
              onClick={async () => {
                if (!confirm('Leave this community?')) return
                try {
                  await leaveCommunityApiCommunitiesCommunityIdLeaveDelete(communityId)
                  setMyMembership(null)
                  refresh()
                } catch {
                  alert('Failed to leave community')
                }
              }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
            >
              Leave Community
            </button>
          ) : myMembership.status === 'rejected' ? (
            (() => {
              const rejectedAt = myMembership.updated_at
                ? new Date(myMembership.updated_at)
                : myMembership.created_at
                  ? new Date(myMembership.created_at)
                  : new Date() // fallback: assume just rejected
              const cooldownEnd = new Date(rejectedAt.getTime() + 24 * 60 * 60 * 1000)
              const canReapply = new Date() >= cooldownEnd
              return canReapply ? (
                <button
                  onClick={async () => {
                    setJoining(true)
                    try {
                      const membership =
                        await joinCommunityApiCommunitiesCommunityIdJoinPost(communityId)
                      setMyMembership(membership)
                    } catch (err: unknown) {
                      const detail = (err as { response?: { data?: { detail?: string } } })
                        ?.response?.data?.detail
                      alert(detail || 'Failed to request to join')
                    }
                    setJoining(false)
                  }}
                  disabled={joining}
                  className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  {joining ? 'Requesting...' : 'Request to Join Again'}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
                  Request declined — you can reapply{' '}
                  {cooldownEnd.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )
            })()
          ) : null}
        </div>
      )}

      {/* Membership management (owner only) */}
      {isOwner && pendingCount > 0 && (
        <div id="pending-requests" className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="font-semibold mb-3">Pending Requests ({pendingCount})</h2>
          <div className="divide-y divide-gray-100">
            {memberships
              .filter((m) => m.status === 'pending')
              .map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2">
                  <span className="text-sm">{m.user_name || `User #${m.user_id}`}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          await updateMembershipApiCommunitiesCommunityIdMembershipsMembershipIdPatch(
                            communityId,
                            m.id,
                            { status: 'approved' }
                          )
                          refresh()
                        } catch {
                          alert('Failed to approve')
                        }
                      }}
                      className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 transition"
                    >
                      Approve
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await updateMembershipApiCommunitiesCommunityIdMembershipsMembershipIdPatch(
                            communityId,
                            m.id,
                            { status: 'rejected' }
                          )
                          refresh()
                        } catch {
                          alert('Failed to reject')
                        }
                      }}
                      className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 transition"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Members list (owner only) */}
      {isOwner && memberships.filter((m) => m.status === 'approved').length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="font-semibold mb-3">
            Members ({memberships.filter((m) => m.status === 'approved').length})
          </h2>
          <div className="divide-y divide-gray-100">
            {memberships
              .filter((m) => m.status === 'approved')
              .map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2">
                  <span className="text-sm">{m.user_name || `User #${m.user_id}`}</span>
                  <button
                    onClick={async () => {
                      if (!confirm('Remove this member?')) return
                      try {
                        await updateMembershipApiCommunitiesCommunityIdMembershipsMembershipIdPatch(
                          communityId,
                          m.id,
                          { status: 'rejected' }
                        )
                        refresh()
                      } catch {
                        alert('Failed to remove member')
                      }
                    }}
                    className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 transition"
                  >
                    Remove
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Moderator / admin actions */}
      {(canManageUsers || isAdmin) && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {canManageUsers && (
            <button
              onClick={handleStatusToggle}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                isUnderReview
                  ? 'border-green-300 text-green-700 hover:bg-green-50'
                  : 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
              }`}
            >
              {isUnderReview ? 'Set Active' : 'Put Under Review'}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-red-300 text-red-700 hover:bg-red-50 transition"
            >
              Delete Community
            </button>
          )}
        </div>
      )}

      {/* Under review banner */}
      {isUnderReview && !canManageUsers && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 font-medium">This community is under review.</p>
          <p className="text-yellow-700 text-sm mt-1">
            Posts and events are temporarily hidden. If you have questions, please{' '}
            <Link to="/contact" className="underline">
              contact us
            </Link>
            .
          </p>
        </div>
      )}

      {/* Content only visible when active (or to moderators) */}
      {(!isUnderReview || canManageUsers) && (
        <>
          {/* Events section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Events</h2>
              {isOwner && (
                <Link
                  to={`/communities/${communityId}/events/new`}
                  className="text-sm bg-brand text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition"
                >
                  New Event
                </Link>
              )}
            </div>
            {events.length === 0 ? (
              <p className="text-gray-400 text-sm">No events yet.</p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    communityId={communityId}
                    isOwner={isOwner}
                    canManage={canManageUsers}
                    onDelete={handleDeleteEvent}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Posts section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Posts</h2>
              {isOwner && (
                <Link
                  to={`/communities/${communityId}/posts/new`}
                  className="text-sm bg-brand text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition"
                >
                  New Post
                </Link>
              )}
            </div>

            {posts.length === 0 ? (
              <p className="text-gray-400 text-sm">No posts yet.</p>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    communityId={communityId}
                    isOwner={isOwner}
                    canManage={canManageUsers}
                    onDelete={handleDeletePost}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function EventCard({
  event,
  communityId,
  isOwner,
  canManage,
  onDelete,
}: {
  event: EventRead
  communityId: number
  isOwner: boolean
  canManage: boolean
  onDelete: (id: number) => void
}) {
  const date = new Date(event.date)
  const isPast = date < new Date()

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${isPast ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <Link to={`/communities/${communityId}/events/${event.id}`} className="flex-1 min-w-0">
          <p className="font-medium hover:text-brand transition">{event.title}</p>
          {event.description && (
            <p className="text-sm text-gray-500 mt-0.5 truncate">{event.description}</p>
          )}
          <p className="text-sm text-gray-500 mt-1">
            {date.toLocaleDateString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}{' '}
            at{' '}
            {date.toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          {event.report_ids && event.report_ids.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {event.report_ids.length} report{event.report_ids.length !== 1 && 's'} linked
            </p>
          )}
        </Link>
        {(isOwner || canManage) && (
          <div className="flex gap-2 flex-shrink-0">
            {isOwner && (
              <Link
                to={`/communities/${communityId}/events/${event.id}/edit`}
                className="text-xs text-brand hover:underline"
              >
                Edit
              </Link>
            )}
            <button
              onClick={() => onDelete(event.id)}
              className="text-xs text-red-500 hover:underline"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function PostCard({
  post,
  communityId,
  isOwner,
  canManage,
  onDelete,
}: {
  post: PostRead
  communityId: number
  isOwner: boolean
  canManage: boolean
  onDelete: (id: number) => void
}) {
  const isLong = post.content.length > 300

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className={isLong ? 'max-h-32 overflow-hidden relative' : ''}>
        <MarkdownRenderer content={isLong ? post.content.slice(0, 300) + '...' : post.content} />
        {isLong && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
        )}
      </div>
      <Link
        to={`/communities/${communityId}/posts/${post.id}`}
        className="text-xs text-brand hover:underline mt-1 inline-block"
      >
        {isLong ? 'Read more' : 'View post'}
      </Link>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400">
          {new Date(post.created_at).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
        {(isOwner || canManage) && (
          <div className="flex gap-2">
            {isOwner && (
              <Link
                to={`/communities/${communityId}/posts/${post.id}?edit=true`}
                className="text-xs text-brand hover:underline"
              >
                Edit
              </Link>
            )}
            <button
              onClick={() => onDelete(post.id)}
              className="text-xs text-red-500 hover:underline"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
