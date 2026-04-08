import { Link } from 'react-router-dom'
import { communityImageUrl } from '../api/client'
import type { CommunityRead } from '../api/model'

interface CommunityCardProps {
  community: CommunityRead
  badge?: 'owned' | 'joined' | 'pending'
  pendingRequests?: number
}

const BADGE_STYLES = {
  owned: 'bg-blue-100 text-blue-700',
  joined: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
} as const

const BADGE_LABELS = {
  owned: 'Owner',
  joined: 'Joined',
  pending: 'Pending',
} as const

export default function CommunityCard({ community, badge, pendingRequests }: CommunityCardProps) {
  return (
    <Link
      to={`/communities/${community.id}`}
      className="block bg-white rounded-lg shadow hover:shadow-md transition overflow-hidden"
    >
      <div className="flex items-center gap-4 p-4">
        {community.profile_image ? (
          <img
            src={communityImageUrl(community.profile_image)}
            alt={community.name}
            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl flex-shrink-0">
            🏘️
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{community.name}</h3>
            {badge && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${BADGE_STYLES[badge]}`}
              >
                {BADGE_LABELS[badge]}
              </span>
            )}
            <span
              className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${
                community.visibility === 'public'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {community.visibility === 'public' ? 'Public' : 'Private'}
            </span>
            {community.status === 'under_review' && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded whitespace-nowrap">
                Under review
              </span>
            )}
          </div>
          {community.description && (
            <p className="text-sm text-gray-500 line-clamp-2">{community.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-400">{community.radius_km} km radius</p>
            {pendingRequests != null && pendingRequests > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                {pendingRequests} pending {pendingRequests === 1 ? 'request' : 'requests'}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
