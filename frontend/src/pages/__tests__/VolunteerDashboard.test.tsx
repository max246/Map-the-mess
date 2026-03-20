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

let mockAuth = { isLoggedIn: true, user: { email: 'volunteer@example.com' } }
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
    mockAuth = { isLoggedIn: true, user: { email: 'volunteer@example.com' } }
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
