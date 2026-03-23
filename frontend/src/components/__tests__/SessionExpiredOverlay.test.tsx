import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SessionExpiredOverlay from '../SessionExpiredOverlay'

/* ── mock useAuth ──────────────────────────────────── */
let mockAuth = {
  sessionExpired: false,
  dismissSessionExpired: jest.fn(),
}

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

/* ── mock useNavigate ──────────────────────────────── */
const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

function renderOverlay(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionExpiredOverlay />
    </MemoryRouter>
  )
}

describe('SessionExpiredOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth = {
      sessionExpired: false,
      dismissSessionExpired: jest.fn(),
    }
  })

  /* ── Public pages: show overlay ─────────────────── */

  it('shows session expired overlay on a public page', () => {
    mockAuth.sessionExpired = true
    renderOverlay('/map')

    expect(screen.getByText('Session Expired')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })

  it('does not show overlay when session is not expired', () => {
    mockAuth.sessionExpired = false
    renderOverlay('/map')

    expect(screen.queryByText('Session Expired')).not.toBeInTheDocument()
  })

  it('dismiss button hides the overlay', async () => {
    mockAuth.sessionExpired = true
    const user = userEvent.setup()
    renderOverlay('/map')

    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(mockAuth.dismissSessionExpired).toHaveBeenCalled()
  })

  it('log in button navigates to login and dismisses', async () => {
    mockAuth.sessionExpired = true
    const user = userEvent.setup()
    renderOverlay('/map')

    await user.click(screen.getByRole('button', { name: /log in/i }))
    expect(mockAuth.dismissSessionExpired).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  /* ── Protected pages: redirect, no overlay ─────── */

  it('redirects to login on /admin when session expired', () => {
    mockAuth.sessionExpired = true
    renderOverlay('/admin')

    expect(screen.queryByText('Session Expired')).not.toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('redirects to login on /admin/users when session expired', () => {
    mockAuth.sessionExpired = true
    renderOverlay('/admin/users')

    expect(screen.queryByText('Session Expired')).not.toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('redirects to login on /volunteers when session expired', () => {
    mockAuth.sessionExpired = true
    renderOverlay('/volunteers')

    expect(screen.queryByText('Session Expired')).not.toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  /* ── Other public pages also show overlay ──────── */

  it('shows overlay on home page', () => {
    mockAuth.sessionExpired = true
    renderOverlay('/')

    expect(screen.getByText('Session Expired')).toBeInTheDocument()
  })

  it('shows overlay on report detail page', () => {
    mockAuth.sessionExpired = true
    renderOverlay('/report/42')

    expect(screen.getByText('Session Expired')).toBeInTheDocument()
  })
})
