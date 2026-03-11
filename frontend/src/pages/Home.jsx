import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-16 md:py-24">
      <h1 className="text-4xl md:text-6xl font-bold mb-4">
        🗺️ Map the Mess
      </h1>
      <p className="text-lg md:text-xl text-gray-600 max-w-xl mb-8">
        Spot litter? Report it. Volunteers will find it on the map and clean it up.
        Together we're making Britain's streets cleaner, one pin at a time.
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

      {/* Quick stats placeholder */}
      <div className="mt-16 grid grid-cols-3 gap-8 text-center">
        {[
          ['📍', 'Reports', '0'],
          ['🧹', 'Cleaned', '0'],
          ['👷', 'Volunteers', '0']
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
