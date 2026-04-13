import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import { getPlanner } from '../api/endpoints/planner/planner'
import { useAuth } from '../context/AuthContext'
import type { PlanListRead } from '../api/model'

const { listPlansApiPlannerGet } = getPlanner()

type StatusFilter = 'all' | 'planned' | 'in_progress' | 'completed'

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'planned', label: 'Planned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
]

function statusBadge(status: string) {
  switch (status) {
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-700'
    case 'completed':
      return 'bg-green-100 text-green-700'
    default:
      return 'bg-blue-100 text-blue-700'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'in_progress':
      return 'In Progress'
    case 'completed':
      return 'Completed'
    default:
      return 'Planned'
  }
}

function formatDistance(meters: number | null | undefined) {
  if (meters == null) return '-'
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return '-'
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
}

export default function PlannerList() {
  const { isLoggedIn } = useAuth()
  const [plans, setPlans] = useState<PlanListRead[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    listPlansApiPlannerGet()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoading(false))
  }, [])

  if (!isLoggedIn) return <Navigate to="/login" replace />

  const filtered = filter === 'all' ? plans : plans.filter((p) => p.status === filter)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <PageMeta
        title="Route Planner"
        description="Plan walking routes to clean up litter reports in your area."
      />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Route Planner</h1>
        <Link
          to="/planner/new"
          className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          Create Plan
        </Link>
      </div>

      <div className="flex border-b mb-6">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              filter === t.key
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">
          <p className="text-4xl mb-3">🗺️</p>
          <p>
            {filter === 'all'
              ? 'No plans yet. Create your first walking route!'
              : `No ${statusLabel(filter).toLowerCase()} plans.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((plan) => (
            <Link
              key={plan.id}
              to={`/planner/${plan.id}`}
              className="bg-white rounded-lg shadow hover:shadow-md transition p-4 block"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(plan.status)}`}
                    >
                      {statusLabel(plan.status)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {plan.report_count} {plan.report_count === 1 ? 'report' : 'reports'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {plan.name || 'Untitled plan'}
                  </p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <span>{formatDistance(plan.total_distance_meters)}</span>
                    <span>{formatDuration(plan.total_duration_seconds)}</span>
                    <span>
                      {new Date(plan.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                <svg
                  className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
