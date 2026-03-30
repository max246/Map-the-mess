import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import { getVolunteers } from '../api/endpoints/volunteers/volunteers'
import type { PublicProfile } from '../api/model'

const { publicProfileApiVolunteersUserIdProfileGet } = getVolunteers()

export default function VolunteerProfile() {
  const { id } = useParams()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    publicProfileApiVolunteersUserIdProfileGet(Number(id))
      .then(setProfile)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="text-center text-gray-400 py-16">Loading...</div>
  }

  if (error || !profile) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">😕</div>
        <p className="text-gray-500 mb-4">Volunteer not found.</p>
        <Link to="/leaderboard" className="text-brand underline">
          ← Back to leaderboard
        </Link>
      </div>
    )
  }

  const memberSince = new Date(profile.member_since).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <PageMeta
        title={profile.name}
        description={`${profile.name} — volunteer on Map the Mess since ${memberSince}.`}
      />
      <Link to="/leaderboard" className="text-sm text-brand underline mb-6 inline-block">
        ← Back to leaderboard
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.name}
            className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
          />
        ) : (
          <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-brand bg-opacity-10 flex items-center justify-center">
            <span className="text-4xl">🧹</span>
          </div>
        )}

        <h1 className="text-2xl font-bold mb-1">{profile.name}</h1>
        <p className="text-sm text-gray-500 mb-4">Volunteer since {memberSince}</p>

        <div className="border-t border-gray-100 pt-4 mt-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Badges
          </h2>
          {profile.badges && profile.badges.length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-center">
              {profile.badges.map((badge) => (
                <span
                  key={badge}
                  className="bg-brand bg-opacity-10 text-brand text-sm font-medium px-3 py-1 rounded-full"
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No badges yet — keep volunteering!</p>
          )}
        </div>
      </div>
    </div>
  )
}
