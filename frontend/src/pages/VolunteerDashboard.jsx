export default function VolunteerDashboard() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">👷 Volunteer Dashboard</h1>
      <p className="text-gray-600 mb-8">
        Browse reported litter near you and plan your next cleanup.
      </p>

      {/* Placeholder — will show list of nearby reports */}
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">
        <p className="text-4xl mb-2">🧹</p>
        <p>No reports claimed yet. Head to the <a href="/map" className="text-brand underline">map</a> to find litter near you!</p>
      </div>
    </div>
  )
}
