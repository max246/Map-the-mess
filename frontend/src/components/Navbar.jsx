import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home' },
  { to: '/map', label: 'Map' },
  { to: '/report', label: 'Report Litter' },
  { to: '/volunteers', label: 'Volunteers' }
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  return (
    <nav className="bg-brand text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-xl font-bold tracking-tight">
          🗺️ Map the Mess
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex gap-6">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`hover:underline ${pathname === l.to ? 'font-semibold underline' : ''}`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden text-2xl" onClick={() => setOpen(!open)}>
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden px-4 pb-4 flex flex-col gap-2">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className={`block py-2 px-3 rounded ${pathname === l.to ? 'bg-brand-dark font-semibold' : 'hover:bg-brand-dark'}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
