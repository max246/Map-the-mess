import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const PROTECTED_PATHS = ['/admin', '/admin/users', '/volunteers']

export default function SessionExpiredOverlay() {
  const { sessionExpired, dismissSessionExpired } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const isProtectedPage = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )

  useEffect(() => {
    if (sessionExpired && isProtectedPage) {
      navigate('/login', { replace: true })
    }
  }, [sessionExpired, isProtectedPage, navigate])

  if (!sessionExpired || isProtectedPage) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-lg font-bold mb-2">Session Expired</h2>
        <p className="text-sm text-gray-500 mb-6">
          Your session has expired. Log in again to continue using all features, or dismiss to keep
          browsing.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              dismissSessionExpired()
              navigate('/login')
            }}
            className="flex-1 bg-brand hover:bg-brand-dark text-white font-semibold py-2.5 rounded-lg transition"
          >
            Log in
          </button>
          <button
            onClick={dismissSessionExpired}
            className="flex-1 border border-gray-300 text-gray-600 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
