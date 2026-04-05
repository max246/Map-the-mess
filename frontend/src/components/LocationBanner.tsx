import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAuth } from '../api/endpoints/auth/auth'

const { getProfileApiAuthMeGet } = getAuth()

export default function LocationBanner() {
  const { isLoggedIn } = useAuth()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) {
      setShow(false)
      return
    }

    getProfileApiAuthMeGet()
      .then((profile) => {
        if (profile.city_latitude === 0 && profile.city_longitude === 0) {
          setShow(true)
        }
      })
      .catch(() => {})
  }, [isLoggedIn])

  if (!show) return null

  return (
    <div className="bg-yellow-100 border-b border-yellow-300 text-yellow-800 text-sm text-center px-4 py-2 flex items-center justify-center gap-2">
      <span>
        Your profile location is not set. Please update it in your{' '}
        <Link to="/volunteers" className="underline font-semibold hover:text-yellow-900">
          volunteer dashboard
        </Link>
        .
      </span>
      <button
        onClick={() => setShow(false)}
        className="ml-2 text-yellow-600 hover:text-yellow-900"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  )
}
