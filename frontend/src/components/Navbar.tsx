import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getCommunities } from '../api/endpoints/communities/communities'

const { listCommunitiesApiCommunitiesGet, listMembershipsApiCommunitiesCommunityIdMembershipsGet } =
  getCommunities()

const topLinks = [
  { to: '/', label: 'Home' },
  { to: '/map', label: 'Map' },
  { to: '/report', label: 'Report Litter' },
]

const discoverLinks = [
  { to: '/communities', label: 'Communities' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/litter-facts', label: 'Litter Facts' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [discoverOpen, setDiscoverOpen] = useState(false)
  const discoverRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const { isLoggedIn, user, canManageUsers, logout } = useAuth()
  const navigate = useNavigate()
  const [hasPending, setHasPending] = useState(false)

  const isVolunteer = isLoggedIn && !canManageUsers

  // Close dropdown on route change
  useEffect(() => {
    setDiscoverOpen(false)
    setMobileOpen(false)
  }, [pathname])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (discoverRef.current && !discoverRef.current.contains(e.target as Node)) {
        setDiscoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Check if any owned community has pending membership requests
  useEffect(() => {
    if (!isLoggedIn || !user) {
      setHasPending(false)
      return
    }
    listCommunitiesApiCommunitiesGet()
      .then((communities) => {
        const owned = communities.filter((c) => c.owner_id === user.id)
        if (owned.length === 0) {
          setHasPending(false)
          return
        }
        Promise.all(
          owned.map((c) => listMembershipsApiCommunitiesCommunityIdMembershipsGet(c.id))
        ).then((results) => {
          const anyPending = results.some((mems) => mems.some((m) => m.status === 'pending'))
          setHasPending(anyPending)
        })
      })
      .catch(() => {})
  }, [isLoggedIn, user, pathname])

  const handleLogout = () => {
    logout()
    setMobileOpen(false)
    navigate('/')
  }

  const isActive = (to: string) => pathname === to
  const isDiscoverActive = discoverLinks.some((l) => pathname === l.to)

  return (
    <nav className="bg-brand text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tight">
          🗺️ Map the Mess
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex gap-5 items-center">
          {topLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`hover:underline ${isActive(l.to) ? 'font-semibold underline' : ''}`}
            >
              {l.label}
            </Link>
          ))}

          {/* Discover dropdown */}
          <div ref={discoverRef} className="relative">
            <button
              onClick={() => setDiscoverOpen(!discoverOpen)}
              className={`flex items-center gap-1 hover:underline ${isDiscoverActive ? 'font-semibold underline' : ''}`}
            >
              Discover
              {hasPending && <span className="w-2 h-2 bg-red-500 rounded-full" />}
              <svg
                className={`w-3.5 h-3.5 transition-transform ${discoverOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {discoverOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50">
                {discoverLinks.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={`block px-4 py-2 text-sm transition ${
                      isActive(l.to)
                        ? 'bg-gray-100 text-brand font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {l.label}
                      {l.to === '/communities' && hasPending && (
                        <span className="w-2 h-2 bg-red-500 rounded-full" />
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {isLoggedIn && isVolunteer && (
            <Link
              to="/volunteers"
              className={`hover:underline ${isActive('/volunteers') ? 'font-semibold underline' : ''}`}
            >
              Dashboard
            </Link>
          )}
          {isLoggedIn && canManageUsers && (
            <>
              <Link
                to="/volunteers"
                className={`hover:underline ${isActive('/volunteers') ? 'font-semibold underline' : ''}`}
              >
                Volunteers
              </Link>
              <Link
                to="/admin"
                className={`hover:underline ${isActive('/admin') ? 'font-semibold underline' : ''}`}
              >
                Admin
              </Link>
            </>
          )}
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded text-sm transition"
            >
              Logout
            </button>
          ) : (
            <>
              <Link
                to="/login"
                className={`hover:underline ${isActive('/login') ? 'font-semibold underline' : ''}`}
              >
                Login
              </Link>
              <Link
                to="/register"
                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded text-sm transition"
              >
                Register
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden text-2xl" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile */}
      {mobileOpen && (
        <div className="md:hidden px-4 pb-4 flex flex-col gap-1">
          {topLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`block py-2 px-3 rounded ${isActive(l.to) ? 'bg-brand-dark font-semibold' : 'hover:bg-brand-dark'}`}
            >
              {l.label}
            </Link>
          ))}

          {/* Discover section — expanded inline on mobile */}
          <div className="py-1 px-3 text-xs uppercase tracking-wide text-white text-opacity-50">
            Discover
          </div>
          {discoverLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`block py-2 px-3 pl-5 rounded ${isActive(l.to) ? 'bg-brand-dark font-semibold' : 'hover:bg-brand-dark'}`}
            >
              {l.label}
              {l.to === '/communities' && hasPending && (
                <span className="inline-block ml-2 w-2 h-2 bg-red-500 rounded-full align-middle" />
              )}
            </Link>
          ))}

          {isLoggedIn && isVolunteer && (
            <Link
              to="/volunteers"
              className={`block py-2 px-3 rounded ${isActive('/volunteers') ? 'bg-brand-dark font-semibold' : 'hover:bg-brand-dark'}`}
            >
              Dashboard
            </Link>
          )}
          {isLoggedIn && canManageUsers && (
            <>
              <Link
                to="/volunteers"
                className={`block py-2 px-3 rounded ${isActive('/volunteers') ? 'bg-brand-dark font-semibold' : 'hover:bg-brand-dark'}`}
              >
                Volunteers
              </Link>
              <Link
                to="/admin"
                className={`block py-2 px-3 rounded ${isActive('/admin') ? 'bg-brand-dark font-semibold' : 'hover:bg-brand-dark'}`}
              >
                Admin
              </Link>
            </>
          )}
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="block py-2 px-3 rounded text-left hover:bg-brand-dark"
            >
              Logout
            </button>
          ) : (
            <>
              <Link
                to="/login"
                className={`block py-2 px-3 rounded ${isActive('/login') ? 'bg-brand-dark font-semibold' : 'hover:bg-brand-dark'}`}
              >
                Login
              </Link>
              <Link
                to="/register"
                className={`block py-2 px-3 rounded ${isActive('/register') ? 'bg-brand-dark font-semibold' : 'hover:bg-brand-dark'}`}
              >
                Register
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
