import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import SessionExpiredOverlay from './components/SessionExpiredOverlay'
import LocationBanner from './components/LocationBanner'
import PendingReportsBanner from './components/PendingReportsBanner'
import QueueManager from './offline/QueueManager'
import { usePwaUpdate } from './pwa/usePwaUpdate'
import api from './api/client'

const ReportLitter = lazy(() => import('./pages/ReportLitter'))
const MapView = lazy(() => import('./pages/MapView'))
const VolunteerDashboard = lazy(() => import('./pages/VolunteerDashboard'))
const ReportDetail = lazy(() => import('./pages/ReportDetail'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Admin = lazy(() => import('./pages/Admin'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const Contact = lazy(() => import('./pages/Contact'))
const Disclaimer = lazy(() => import('./pages/Disclaimer'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const LitterFacts = lazy(() => import('./pages/LitterFacts'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const CommunitySearch = lazy(() => import('./pages/CommunitySearch'))
const CreateCommunity = lazy(() => import('./pages/CreateCommunity'))
const CommunityDetail = lazy(() => import('./pages/CommunityDetail'))
const CreateEvent = lazy(() => import('./pages/CreateEvent'))
const EditEvent = lazy(() => import('./pages/EditEvent'))
const AdminCommunities = lazy(() => import('./pages/AdminCommunities'))
const EventDetail = lazy(() => import('./pages/EventDetail'))
const PostDetail = lazy(() => import('./pages/PostDetail'))
const Tools = lazy(() => import('./pages/Tools'))
const VolunteerProfile = lazy(() => import('./pages/VolunteerProfile'))
const NotFound = lazy(() => import('./pages/NotFound'))

const RouteFallback = () => (
  <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading…</div>
)

function App() {
  const [version, setVersion] = useState<string | null>(null)
  const { needRefresh, updateServiceWorker } = usePwaUpdate()

  useEffect(() => {
    api
      .get('/backend/')
      .then((res) => setVersion(res.data.version))
      .catch(() => {})
  }, [])

  return (
    <HelmetProvider>
      <AuthProvider>
        <QueueManager />
        <div className="h-dvh flex flex-col overflow-hidden">
          <PendingReportsBanner />
          {needRefresh && (
            <div
              role="status"
              className="bg-green-50 border-b border-green-200 text-green-900 text-sm"
            >
              <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
                <span>A new version of Map the Mess is available.</span>
                <button
                  type="button"
                  onClick={() => updateServiceWorker(true)}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1 rounded"
                >
                  Refresh
                </button>
              </div>
            </div>
          )}
          <Navbar />
          <LocationBanner />
          <SessionExpiredOverlay />
          <main className="flex-1 overflow-auto">
            <Suspense fallback={<RouteFallback />}>
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
                <Route path="/admin/communities" element={<AdminCommunities />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/disclaimer" element={<Disclaimer />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/litter-facts" element={<LitterFacts />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/tools" element={<Tools />} />
                <Route path="/volunteers/:id" element={<VolunteerProfile />} />
                <Route path="/communities" element={<CommunitySearch />} />
                <Route path="/communities/new" element={<CreateCommunity />} />
                <Route path="/communities/:id" element={<CommunityDetail />} />
                <Route path="/communities/:id/events/new" element={<CreateEvent />} />
                <Route path="/communities/:id/posts/:postId" element={<PostDetail />} />
                <Route path="/communities/:id/events/:eventId" element={<EventDetail />} />
                <Route path="/communities/:id/events/:eventId/edit" element={<EditEvent />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
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
    </HelmetProvider>
  )
}

export default App
