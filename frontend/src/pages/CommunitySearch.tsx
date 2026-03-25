import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCommunities } from '../api/endpoints/communities/communities'
import { useAuth } from '../context/AuthContext'
import CommunityCard from '../components/CommunityCard'
import type { CommunityRead } from '../api/model'

const { listCommunitiesApiCommunitiesGet, myCommunitiesApiCommunitiesMineGet } = getCommunities()

type Tab = 'owned' | 'joined' | 'name' | 'nearby'

export default function CommunitySearch() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('owned')
  const [search, setSearch] = useState('')
  const [radiusKm, setRadiusKm] = useState(10)
  const [results, setResults] = useState<CommunityRead[]>([])
  const [owned, setOwned] = useState<CommunityRead[]>([])
  const [joined, setJoined] = useState<CommunityRead[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [myLoading, setMyLoading] = useState(true)

  // Track joined/owned/pending community IDs for search result badges
  const [ownedIds, setOwnedIds] = useState<Set<number>>(new Set())
  const [joinedIds, setJoinedIds] = useState<Set<number>>(new Set())
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!isLoggedIn) navigate('/login', { replace: true })
  }, [isLoggedIn, navigate])

  useEffect(() => {
    if (!isLoggedIn) return
    myCommunitiesApiCommunitiesMineGet()
      .then((data) => {
        const o = data.owned || []
        const j = data.joined || []
        const p = data.pending || []
        setOwned(o)
        setJoined(j)
        setOwnedIds(new Set(o.map((c) => c.id)))
        setJoinedIds(new Set(j.map((c) => c.id)))
        setPendingIds(new Set(p.map((c) => c.id)))
      })
      .catch(console.error)
      .finally(() => setMyLoading(false))
  }, [isLoggedIn])

  const handleNameSearch = () => {
    if (!search.trim()) return
    setLoading(true)
    setSearched(true)
    listCommunitiesApiCommunitiesGet({ search: search.trim() })
      .then(setResults)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  const handleNearbySearch = () => {
    setLoading(true)
    setSearched(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        listCommunitiesApiCommunitiesGet({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          radius_km: radiusKm,
        })
          .then(setResults)
          .catch(console.error)
          .finally(() => setLoading(false))
      },
      () => {
        alert('Could not get your location. Please allow location access.')
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const getBadge = (c: CommunityRead) => {
    if (ownedIds.has(c.id)) return 'owned' as const
    if (joinedIds.has(c.id)) return 'joined' as const
    if (pendingIds.has(c.id)) return 'pending' as const
    return undefined
  }

  if (!isLoggedIn) return null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'owned', label: 'My Communities' },
    { key: 'joined', label: 'Joined' },
    { key: 'name', label: 'Search by name' },
    { key: 'nearby', label: 'Near me' },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Communities</h1>
        <Link
          to="/communities/new"
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          Create Community
        </Link>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              tab === t.key ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Owned tab */}
      {tab === 'owned' && (
        <CommunityList
          loading={myLoading}
          communities={owned}
          emptyMessage="You don't own any communities yet."
          emptyAction={
            <Link to="/communities/new" className="text-brand underline text-sm mt-2 inline-block">
              Create one
            </Link>
          }
        />
      )}

      {/* Joined tab */}
      {tab === 'joined' && (
        <CommunityList
          loading={myLoading}
          communities={joined}
          emptyMessage="You haven't joined any communities yet."
          emptyAction={
            <button
              onClick={() => setTab('name')}
              className="text-brand underline text-sm mt-2 inline-block"
            >
              Search for communities
            </button>
          }
        />
      )}

      {/* Search by name tab */}
      {tab === 'name' && (
        <>
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSearch()}
              placeholder="Community name..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={handleNameSearch}
              disabled={loading || !search.trim()}
              className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              Search
            </button>
          </div>
          <SearchResults
            loading={loading}
            searched={searched}
            results={results}
            getBadge={getBadge}
          />
        </>
      )}

      {/* Near me tab */}
      {tab === 'nearby' && (
        <>
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">
                Radius: {radiusKm} km
              </label>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseInt(e.target.value))}
                className="flex-1"
              />
            </div>
            <button
              onClick={handleNearbySearch}
              disabled={loading}
              className="w-full bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Locating...' : 'Find communities near me'}
            </button>
          </div>
          <SearchResults
            loading={loading}
            searched={searched}
            results={results}
            getBadge={getBadge}
          />
        </>
      )}
    </div>
  )
}

function CommunityList({
  loading,
  communities,
  emptyMessage,
  emptyAction,
}: {
  loading: boolean
  communities: CommunityRead[]
  emptyMessage: string
  emptyAction: React.ReactNode
}) {
  if (loading) return <div className="text-center text-gray-400 py-8">Loading...</div>
  if (communities.length === 0)
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">🏘️</div>
        <p className="text-gray-500">{emptyMessage}</p>
        {emptyAction}
      </div>
    )
  return (
    <div className="space-y-3">
      {communities.map((c) => (
        <CommunityCard key={c.id} community={c} />
      ))}
    </div>
  )
}

function SearchResults({
  loading,
  searched,
  results,
  getBadge,
}: {
  loading: boolean
  searched: boolean
  results: CommunityRead[]
  getBadge: (c: CommunityRead) => 'owned' | 'joined' | 'pending' | undefined
}) {
  if (loading) return <div className="text-center text-gray-400 py-8">Searching...</div>

  if (searched && results.length === 0)
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">🏘️</div>
        <p className="text-gray-500">No communities found.</p>
        <Link to="/communities/new" className="text-brand underline text-sm mt-2 inline-block">
          Create one?
        </Link>
      </div>
    )

  if (results.length > 0)
    return (
      <div className="space-y-3">
        {results.map((c) => (
          <CommunityCard key={c.id} community={c} badge={getBadge(c)} />
        ))}
      </div>
    )

  return null
}
