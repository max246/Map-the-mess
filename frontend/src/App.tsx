import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import ReportLitter from './pages/ReportLitter'
import MapView from './pages/MapView'
import VolunteerDashboard from './pages/VolunteerDashboard'
import ReportDetail from './pages/ReportDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Admin from './pages/Admin'
import UserManagement from './pages/UserManagement'
import VerifyEmail from './pages/VerifyEmail'
import Contact from './pages/Contact'
import api from './api/client'

function App() {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    api
      .get('/backend/')
      .then((res) => setVersion(res.data.version))
      .catch(() => {})
  }, [])

  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/report" element={<ReportLitter />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/report/:id" element={<ReportDetail />} />
            <Route path="/volunteers" element={<VolunteerDashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </main>
        {version && (
          <footer className="text-center text-xs text-gray-400 py-3">
            <a
              href={`https://github.com/max246/Map-the-mess/releases/tag/v${version}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              v{version}
            </a>
          </footer>
        )}
      </div>
    </AuthProvider>
  )
}

export default App
