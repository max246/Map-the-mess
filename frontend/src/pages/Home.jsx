import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getReports } from '../api/endpoints/reports/reports'
import { getVolunteers } from '../api/endpoints/volunteers/volunteers'

const { listReportsApiReportsGet } = getReports()
const { listVolunteersApiVolunteersGet } = getVolunteers()

export default function Home() {
  const [stats, setStats] = useState({ reports: 0, cleaned: 0, volunteers: 0 })
  const [reports, setReports] = useState([])

  useEffect(() => {
    Promise.all([listReportsApiReportsGet(), listVolunteersApiVolunteersGet()])
      .then(([reportsData, volunteersData]) => {
        setReports(reportsData)
        setStats({
          reports: reportsData.length,
          cleaned: reportsData.filter((r) => r.status === 'cleaned').length,
          volunteers: Array.isArray(volunteersData) ? volunteersData.length : 0,
        })
      })
      .catch(console.error)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-16 md:py-24">
      <h1 className="text-4xl md:text-6xl font-bold mb-4">🗺️ Map the Mess</h1>
      <p className="text-lg md:text-xl text-gray-600 max-w-xl mb-8">
        Spot litter? Report it. Volunteers will find it on the map and clean it up. Together we're
        making Britain's streets cleaner, one pin at a time.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          to="/report"
          className="bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3 rounded-lg text-lg transition"
        >
          📸 Report Litter
        </Link>
        <Link
          to="/map"
          className="border-2 border-brand text-brand hover:bg-brand hover:text-white font-semibold px-8 py-3 rounded-lg text-lg transition"
        >
          🗺️ View Map
        </Link>
      </div>

      {/* Recent reports */}
      {reports.length > 0 && (
        <div className="mt-12 w-full max-w-2xl text-left">
          <h2 className="text-xl font-bold mb-4">Recent Reports</h2>
          <ul className="divide-y divide-gray-200 bg-white rounded-lg shadow">
            {reports.slice(0, 10).map((r) => (
              <li key={r.id} className="px-4 py-3">
                <Link
                  to={`/report/${r.id}`}
                  className="flex items-center justify-between hover:bg-gray-50 -mx-4 -my-3 px-4 py-3 rounded"
                >
                  <div>
                    <span className="mr-2">{r.status === 'cleaned' ? '✅' : '🔴'}</span>
                    <span>{r.description || 'No description'}</span>
                    {r.what3words && (
                      <span className="ml-2 text-xs text-brand font-medium">
                        /// {r.what3words}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400">
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick stats */}
      <div className="mt-16 grid grid-cols-3 gap-8 text-center">
        {[
          ['📍', 'Reports', stats.reports],
          ['🧹', 'Cleaned', stats.cleaned],
          ['👷', 'Volunteers', stats.volunteers],
        ].map(([icon, label, count]) => (
          <div key={label}>
            <div className="text-3xl">{icon}</div>
            <div className="text-2xl font-bold">{count}</div>
            <div className="text-gray-500 text-sm">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
