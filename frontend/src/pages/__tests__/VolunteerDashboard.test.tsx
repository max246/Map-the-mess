import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import VolunteerDashboard from '../VolunteerDashboard'

/* ── mock data ─────────────────────────────────────────── */
const FAVOURITES = [
  {
    id: 1,
    description: 'Bottles on path',
    status: 'reported',
    latitude: 51.5,
    longitude: -0.1,
    created_at: '2026-01-01T00:00:00Z',
    what3words: 'fill.count.soap',
    images: [{ id: 10, image_type: 'report', path: 'img/10.jpg' }],
  },
  {
    id: 2,
    description: 'Wrappers in alley',
    status: 'cleaned',
    latitude: 52.0,
    longitude: -1.0,
    created_at: '2026-01-05T00:00:00Z',
    what3words: '',
    images: [],
  },
]

const UNRESOLVED = [
  {
    id: 3,
    description: 'Cans near bus stop',
    status: 'reported',
    latitude: 53.0,
    longitude: -2.0,
    created_at: '2026-01-10T00:00:00Z',
    what3words: '',
    images: [],
  },
  {
    id: 4,
    description: 'Litter under bridge',
    status: 'reported',
    latitude: 54.0,
    longitude: -1.5,
    created_at: '2026-01-12T00:00:00Z',
    what3words: 'word.one.two',
    images: [],
  },
]

const RESOLVED = [
  {
    id: 5,
    description: 'Park cleaned up',
    status: 'cleaned',
    latitude: 51.0,
    longitude: -0.5,
    created_at: '2026-01-02T00:00:00Z',
    what3words: '',
    images: [],
  },
]

/* ── mocks ────────────────────────────────────────────── */
const mockListFavourites = jest.fn()
const mockListReports = jest.fn()
const mockAddFavourite = jest.fn()
const mockRemoveFavourite = jest.fn()

jest.mock('../../api/endpoints/reports/reports', () => ({
  getReports: () => ({
    listReportsApiReportsGet: (...args: unknown[]) => mockListReports(...args),
  }),
}))

jest.mock('../../api/endpoints/volunteers/volunteers', () => ({
  getVolunteers: () => ({
    listFavouritesApiVolunteersFavouritesGet: (...args: unknown[]) => mockListFavourites(...args),
    addFavouriteApiVolunteersFavouritesReportIdPost: (...args: unknown[]) =>
      mockAddFavourite(...args),
    removeFavouriteApiVolunteersFavouritesReportIdDelete: (...args: unknown[]) =>
      mockRemoveFavourite(...args),
  }),
}))

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  thumbnailUrl: () => 'thumb.jpg',
}))

const mockGetProfile = jest.fn()
const mockUpdateProfile = jest.fn()
const mockUploadAvatar = jest.fn()
const mockChangePassword = jest.fn()

jest.mock('../../api/endpoints/auth/auth', () => ({
  getAuth: () => ({
    getProfileApiAuthMeGet: (...args: unknown[]) => mockGetProfile(...args),
    updateProfileApiAuthMePatch: (...args: unknown[]) => mockUpdateProfile(...args),
    uploadAvatarApiAuthMeAvatarPut: (...args: unknown[]) => mockUploadAvatar(...args),
    changePasswordApiAuthMePasswordPatch: (...args: unknown[]) => mockChangePassword(...args),
  }),
}))

let mockAuth = { isLoggedIn: true, user: { id: 1, email: 'volunteer@example.com' } }
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

function renderDashboard() {
  return render(
    <MemoryRouter>
      <VolunteerDashboard />
    </MemoryRouter>
  )
}

describe('VolunteerDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth = { isLoggedIn: true, user: { id: 1, email: 'volunteer@example.com' } }
    mockGetProfile.mockResolvedValue({ full_name: 'Test User', avatar_url: null })
    mockUpdateProfile.mockResolvedValue({})
    mockChangePassword.mockResolvedValue({})
    mockListFavourites.mockResolvedValue(FAVOURITES)
    mockListReports.mockResolvedValue([])
    mockAddFavourite.mockResolvedValue({})
    mockRemoveFavourite.mockResolvedValue({})
  })

  /* ── Access control ──────────────────────────────── */

  it('redirects to login when not logged in', () => {
    mockAuth = { isLoggedIn: false, user: null as never }
    renderDashboard()
    expect(screen.queryByText('Volunteer Dashboard')).not.toBeInTheDocument()
  })

  /* ── Rendering ───────────────────────────────────── */

  it('renders the page title', async () => {
    renderDashboard()
    expect(await screen.findByText('Volunteer Dashboard')).toBeInTheDocument()
  })

  it('shows welcome message with user email', async () => {
    renderDashboard()
    expect(await screen.findByText('volunteer@example.com')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    mockListFavourites.mockReturnValue(new Promise(() => {}))
    renderDashboard()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  /* ── Tabs ────────────────────────────────────────── */

  it('shows all three tabs', () => {
    renderDashboard()
    expect(screen.getByRole('button', { name: 'My Favourites' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unresolved Reports' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resolved Reports' })).toBeInTheDocument()
  })

  it('defaults to favourites tab', async () => {
    renderDashboard()
    expect(await screen.findByText('Bottles on path')).toBeInTheDocument()
    expect(screen.getByText('Wrappers in alley')).toBeInTheDocument()
  })

  it('switches to unresolved tab', async () => {
    mockListReports.mockResolvedValue(UNRESOLVED)
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('Bottles on path')

    await user.click(screen.getByRole('button', { name: 'Unresolved Reports' }))

    expect(await screen.findByText('Cans near bus stop')).toBeInTheDocument()
    expect(screen.getByText('Litter under bridge')).toBeInTheDocument()
  })

  it('switches to resolved tab', async () => {
    mockListReports.mockResolvedValue(RESOLVED)
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('Bottles on path')

    await user.click(screen.getByRole('button', { name: 'Resolved Reports' }))

    expect(await screen.findByText('Park cleaned up')).toBeInTheDocument()
  })

  /* ── Report cards ────────────────────────────────── */

  it('shows report status badges', async () => {
    renderDashboard()
    await screen.findByText('Bottles on path')
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Cleaned')).toBeInTheDocument()
  })

  it('shows report IDs', async () => {
    renderDashboard()
    await screen.findByText('Bottles on path')
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
  })

  it('shows what3words when available', async () => {
    renderDashboard()
    expect(await screen.findByText(/fill\.count\.soap/)).toBeInTheDocument()
  })

  it('links reports to detail page', async () => {
    renderDashboard()
    await screen.findByText('Bottles on path')
    const links = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('/report/'))
    expect(links.some((a) => a.getAttribute('href') === '/report/1')).toBe(true)
    expect(links.some((a) => a.getAttribute('href') === '/report/2')).toBe(true)
  })

  /* ── Favourites ──────────────────────────────────── */

  it('shows star buttons on report cards', async () => {
    renderDashboard()
    await screen.findByText('Bottles on path')
    const starButtons = screen.getAllByTitle(/favourites/i)
    expect(starButtons).toHaveLength(2)
  })

  it('shows filled star for favourited reports', async () => {
    renderDashboard()
    await screen.findByText('Bottles on path')
    const starButtons = screen.getAllByTitle('Remove from favourites')
    expect(starButtons.length).toBeGreaterThan(0)
    expect(starButtons[0].textContent).toBe('★')
  })

  it('removes favourite when unstarring on favourites tab', async () => {
    mockRemoveFavourite.mockResolvedValue({})
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('Bottles on path')

    const starButtons = screen.getAllByTitle('Remove from favourites')
    await user.click(starButtons[0])

    expect(mockRemoveFavourite).toHaveBeenCalledWith(1)
    await waitFor(() => {
      expect(screen.queryByText('Bottles on path')).not.toBeInTheDocument()
    })
  })

  /* ── Profile section ─────────────────────────────── */

  it('loads and displays the user name from profile', async () => {
    renderDashboard()
    expect(await screen.findByText('Test User')).toBeInTheDocument()
  })

  it('shows email in profile section', async () => {
    renderDashboard()
    expect(await screen.findByText('volunteer@example.com')).toBeInTheDocument()
  })

  it('shows default avatar when avatar_url is null', async () => {
    renderDashboard()
    const avatar = await screen.findByAltText('Avatar')
    expect(avatar).toHaveAttribute('src', '/avatars/womble1.png')
  })

  it('shows avatar from profile when avatar_url is a womble', async () => {
    mockGetProfile.mockResolvedValue({ full_name: 'Test User', avatar_url: '/avatars/womble3.png' })
    renderDashboard()
    const avatar = await screen.findByAltText('Avatar')
    expect(avatar).toHaveAttribute('src', '/avatars/womble3.png')
  })

  it('shows edit name button', async () => {
    renderDashboard()
    await screen.findByText('Test User')
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('opens name editing form when Edit is clicked', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('Test User')

    await user.click(screen.getByRole('button', { name: /edit/i }))

    expect(screen.getByPlaceholderText('Your full name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('saves updated name via API', async () => {
    mockUpdateProfile.mockResolvedValue({ full_name: 'New Name', avatar_url: null })
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('Test User')

    await user.click(screen.getByRole('button', { name: /edit/i }))
    const input = screen.getByPlaceholderText('Your full name')
    await user.clear(input)
    await user.type(input, 'New Name')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(mockUpdateProfile).toHaveBeenCalledWith({ full_name: 'New Name' })
    expect(await screen.findByText('Name updated!')).toBeInTheDocument()
  })

  it('shows error when name update fails', async () => {
    mockUpdateProfile.mockRejectedValue(new Error('Server error'))
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('Test User')

    await user.click(screen.getByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText(/failed to update name/i)).toBeInTheDocument()
  })

  it('cancels name editing', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('Test User')

    await user.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByPlaceholderText('Your full name')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByPlaceholderText('Your full name')).not.toBeInTheDocument()
  })

  it('shows change password link', async () => {
    renderDashboard()
    await screen.findByText('Test User')
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument()
  })

  it('opens password form when Change password is clicked', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('Test User')

    await user.click(screen.getByRole('button', { name: /change password/i }))

    expect(screen.getByPlaceholderText('Current password')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('New password (min 6 characters)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Confirm new password')).toBeInTheDocument()
  })

  it('validates password minimum length', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('Test User')

    await user.click(screen.getByRole('button', { name: /change password/i }))
    await user.type(screen.getByPlaceholderText('Current password'), 'oldpass')
    await user.type(screen.getByPlaceholderText(/new password \(min/i), '12345')
    await user.type(screen.getByPlaceholderText(/confirm new password/i), '12345')
    await user.click(screen.getByRole('button', { name: /^change password$/i }))

    expect(await screen.findByText(/at least 6 characters/i)).toBeInTheDocument()
    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('validates password match', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('Test User')

    await user.click(screen.getByRole('button', { name: /change password/i }))
    await user.type(screen.getByPlaceholderText('Current password'), 'oldpass')
    await user.type(screen.getByPlaceholderText(/new password \(min/i), 'newpass123')
    await user.type(screen.getByPlaceholderText(/confirm new password/i), 'different')
    await user.click(screen.getByRole('button', { name: /^change password$/i }))

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument()
    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('calls change password API with correct data', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('Test User')

    await user.click(screen.getByRole('button', { name: /change password/i }))
    await user.type(screen.getByPlaceholderText('Current password'), 'oldpass')
    await user.type(screen.getByPlaceholderText(/new password \(min/i), 'newpass123')
    await user.type(screen.getByPlaceholderText(/confirm new password/i), 'newpass123')
    await user.click(screen.getByRole('button', { name: /^change password$/i }))

    expect(mockChangePassword).toHaveBeenCalledWith({
      current_password: 'oldpass',
      new_password: 'newpass123',
    })
    expect(await screen.findByText('Password changed!')).toBeInTheDocument()
  })

  it('shows error when password change fails', async () => {
    mockChangePassword.mockRejectedValue(new Error('Wrong password'))
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('Test User')

    await user.click(screen.getByRole('button', { name: /change password/i }))
    await user.type(screen.getByPlaceholderText('Current password'), 'wrong')
    await user.type(screen.getByPlaceholderText(/new password \(min/i), 'newpass123')
    await user.type(screen.getByPlaceholderText(/confirm new password/i), 'newpass123')
    await user.click(screen.getByRole('button', { name: /^change password$/i }))

    expect(await screen.findByText(/failed to change password/i)).toBeInTheDocument()
  })

  it('selects a womble avatar and calls update profile', async () => {
    mockUpdateProfile.mockResolvedValue({
      full_name: 'Test User',
      avatar_url: '/avatars/womble2.png',
    })
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('Test User')

    // Hover to reveal Change button and click it
    const avatar = screen.getByAltText('Avatar')
    await user.click(avatar.parentElement!.querySelector('button')!)

    // Pick womble2
    const wombleOptions = screen.getAllByAltText('')
    await user.click(wombleOptions[1]) // second womble

    expect(mockUpdateProfile).toHaveBeenCalledWith({ avatar_url: '/avatars/womble2.png' })
  })

  it('shows badges coming soon section', async () => {
    renderDashboard()
    expect(await screen.findByText('Badges')).toBeInTheDocument()
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })

  /* ── Empty states ────────────────────────────────── */

  it('shows empty favourites message', async () => {
    mockListFavourites.mockResolvedValue([])
    renderDashboard()
    expect(await screen.findByText(/no favourites yet/i)).toBeInTheDocument()
  })

  it('shows empty unresolved message', async () => {
    mockListReports.mockResolvedValue([])
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('Bottles on path')

    await user.click(screen.getByRole('button', { name: 'Unresolved Reports' }))

    expect(await screen.findByText(/community is looking clean/i)).toBeInTheDocument()
  })

  it('shows empty resolved message', async () => {
    mockListReports.mockResolvedValue([])
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('Bottles on path')

    await user.click(screen.getByRole('button', { name: 'Resolved Reports' }))

    expect(await screen.findByText(/no resolved reports yet/i)).toBeInTheDocument()
  })
})
