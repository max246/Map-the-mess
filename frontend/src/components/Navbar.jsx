import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const publicLinks = [
  { to: '/', label: 'Home' },
  { to: '/map', label: 'Map' },
  { to: '/report', label: 'Report Litter' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const { isLoggedIn, canManageUsers, user, logout } = useAuth()
  const navigate = useNavigate()

  const isVolunteer = isLoggedIn && !canManageUsers

  const handleLogout = () => {
    logout()
    setOpen(false)
    navigate('/')
  }

  const navLink = (to, label, onClick) => (
    <Link
      key={to}
      to={to}
      onClick={onClick}
      className={`hover:underline ${pathname === to ? 'font-semibold underline' : ''}`}
    >
      {label}
    </Link>
  )

  const mobileLink = (to, label) => (
    <Link
      key={to}
      to={to}
      onClick={() => setOpen(false)}
      className={`block py-2 px-3 rounded ${pathname === to ? 'bg-brand-dark font-semibold' : 'hover:bg-brand-dark'}`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="bg-brand text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tight">
          🗺️ Map the Mess
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex gap-6 items-center">
          {publicLinks.map((l) => navLink(l.to, l.label))}
          {isLoggedIn && isVolunteer && navLink('/volunteers', 'Dashboard')}
          {isLoggedIn && canManageUsers && (
            <>
              {navLink('/volunteers', 'Volunteers')}
              {navLink('/admin', 'Admin')}
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
              {navLink('/login', 'Login')}
              <Link
                to="/register"
                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded text-sm transition"
              >
                Register
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden text-2xl" onClick={() => setOpen(!open)}>
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile */}
      {open && (
        <div className="md:hidden px-4 pb-4 flex flex-col gap-2">
          {publicLinks.map((l) => mobileLink(l.to, l.label))}
          {isLoggedIn && isVolunteer && mobileLink('/volunteers', 'Dashboard')}
          {isLoggedIn && canManageUsers && (
            <>
              {mobileLink('/volunteers', 'Volunteers')}
              {mobileLink('/admin', 'Admin')}
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
              {mobileLink('/login', 'Login')}
              {mobileLink('/register', 'Register')}
            </>
          )}
        </div>
      )}
    </nav>
  )
}
