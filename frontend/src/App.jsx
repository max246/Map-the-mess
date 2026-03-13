import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import ReportLitter from './pages/ReportLitter'
import MapView from './pages/MapView'
import VolunteerDashboard from './pages/VolunteerDashboard'
import ReportDetail from './pages/ReportDetail'

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/report" element={<ReportLitter />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/report/:id" element={<ReportDetail />} />
          <Route path="/volunteers" element={<VolunteerDashboard />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
