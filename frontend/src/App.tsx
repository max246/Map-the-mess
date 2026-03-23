import { useState, useEffect } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
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
import Disclaimer from './pages/Disclaimer'
import PrivacyPolicy from './pages/PrivacyPolicy'
import LitterFacts from './pages/LitterFacts'
import SessionExpiredOverlay from './components/SessionExpiredOverlay'
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
      <div className="h-dvh flex flex-col overflow-hidden">
        <Navbar />
        <SessionExpiredOverlay />
        <main className="flex-1 overflow-auto">
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
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/litter-facts" element={<LitterFacts />} />
          </Routes>
        </main>
        <footer className="text-xs text-gray-400 py-2 px-4 flex items-center justify-center gap-3 flex-wrap">
          <Link to="/disclaimer" className="hover:underline">
            Disclaimer
          </Link>
          <Link to="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
          <a
            href="https://www.facebook.com/profile.php?id=61577665256083"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-300 transition-colors"
            aria-label="Facebook"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </a>
          {version && (
            <a
              href={`https://github.com/max246/Map-the-mess/releases/tag/${version}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              v{version}
            </a>
          )}
        </footer>
      </div>
    </AuthProvider>
  )
}

export default App
