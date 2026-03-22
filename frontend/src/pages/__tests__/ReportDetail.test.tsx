import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ReportDetail from '../ReportDetail'

/* ── mock data ─────────────────────────────────────────── */
const REPORT_WITH_IMAGES = {
  id: 42,
  description: 'Broken bottles near park',
  status: 'reported',
  latitude: 51.50735,
  longitude: -0.12776,
  created_at: '2026-01-15T10:30:00Z',
  what3words: 'filled.count.soap',
  address: '123 Test Street, London',
  resolved_at: null,
  images: [
    { id: 101, image_type: 'report', path: 'images/101.jpg' },
    { id: 102, image_type: 'report', path: 'images/102.jpg' },
  ],
}

const RESOLVED_REPORT = {
  id: 43,
  description: 'Cleaned up bags',
  status: 'cleaned',
  latitude: 52.0,
  longitude: -1.0,
  created_at: '2026-01-10T08:00:00Z',
  what3words: '',
  resolved_at: '2026-01-12T14:00:00Z',
  images: [
    { id: 201, image_type: 'report', path: 'images/201.jpg' },
    { id: 202, image_type: 'resolved', path: 'images/202.jpg' },
  ],
}

/* ── mocks ────────────────────────────────────────────── */
const mockGet = jest.fn()
const mockPatch = jest.fn()
const mockPost = jest.fn()
const mockDelete = jest.fn()

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
  imageUrl: (img: { path: string }) => `/api/${img.path}`,
  thumbnailUrl: (img: { path: string }) => `/api/${img.path}?thumb`,
}))

let mockAuth = { token: null as string | null, canManageUsers: false, isLoggedIn: false }
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

jest.mock('../../api/endpoints/reports/reports', () => ({
  getReports: () => ({
    deleteImageApiReportsImagesImageIdDelete: jest.fn(),
    addImageApiReportsReportIdImagesPost: jest.fn(),
  }),
}))

jest.mock('../../api/endpoints/volunteers/volunteers', () => ({
  getVolunteers: () => ({
    listFavouritesApiVolunteersFavouritesGet: jest.fn().mockResolvedValue([]),
    addFavouriteApiVolunteersFavouritesReportIdPost: jest.fn(),
    removeFavouriteApiVolunteersFavouritesReportIdDelete: jest.fn(),
  }),
}))

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mini-map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => <div data-testid="map-marker" />,
}))

function renderReportDetail(reportId: string = '42') {
  return render(
    <MemoryRouter initialEntries={[`/report/${reportId}`]}>
      <Routes>
        <Route path="/report/:id" element={<ReportDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ReportDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth = { token: null, canManageUsers: false, isLoggedIn: false }
    mockGet.mockResolvedValue({ data: REPORT_WITH_IMAGES })
  })

  /* ── Loading & error states ──────────────────────── */

  it('shows loading state initially', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    renderReportDetail()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows error when report not found', async () => {
    mockGet.mockRejectedValue(new Error('404'))
    renderReportDetail()
    expect(await screen.findByText('Report not found')).toBeInTheDocument()
  })

  /* ── Images ──────────────────────────────────────── */

  it('displays report images', async () => {
    renderReportDetail()
    await waitFor(() => {
      const images = screen.getAllByRole('img')
      expect(images.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows thumbnail strip for multiple images', async () => {
    renderReportDetail()
    await waitFor(() => {
      expect(screen.getByAltText('Thumbnail 1')).toBeInTheDocument()
      expect(screen.getByAltText('Thumbnail 2')).toBeInTheDocument()
    })
  })

  it('shows add photo button for unresolved reports', async () => {
    renderReportDetail()
    await waitFor(() => {
      // The "+" button for adding more photos
      const addButtons = screen.getAllByRole('button').filter((btn) => btn.textContent === '+')
      expect(addButtons.length).toBeGreaterThan(0)
    })
  })

  it('does not show add photo button for resolved reports', async () => {
    mockGet.mockResolvedValue({ data: RESOLVED_REPORT })
    renderReportDetail('43')
    await waitFor(() => {
      expect(screen.getByText(/Cleaned up bags/i)).toBeInTheDocument()
    })
    const addButtons = screen.getAllByRole('button').filter((btn) => btn.textContent === '+')
    expect(addButtons).toHaveLength(0)
  })

  /* ── Report details ─────────────────────────────── */

  it('shows the report title with ID', async () => {
    renderReportDetail()
    expect(await screen.findByText(/Report #42/)).toBeInTheDocument()
  })

  it('shows the report description', async () => {
    renderReportDetail()
    expect(await screen.findByText('Broken bottles near park')).toBeInTheDocument()
  })

  it('shows the status as pending', async () => {
    renderReportDetail()
    expect(await screen.findByText(/Pending/)).toBeInTheDocument()
  })

  /* ── Location ────────────────────────────────────── */

  it('displays coordinates with Google Maps link', async () => {
    renderReportDetail()
    const coordLink = await screen.findByText('51.50735, -0.12776')
    expect(coordLink.closest('a')).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=51.50735,-0.12776'
    )
  })

  it('displays reverse geocoded address', async () => {
    renderReportDetail()
    expect(await screen.findByText('123 Test Street, London')).toBeInTheDocument()
  })

  it('shows the mini map', async () => {
    renderReportDetail()
    await waitFor(() => {
      expect(screen.getByTestId('mini-map')).toBeInTheDocument()
    })
  })

  /* ── what3words ──────────────────────────────────── */

  it('displays what3words address with link', async () => {
    renderReportDetail()
    const w3wLink = await screen.findByText('/// filled.count.soap')
    expect(w3wLink.closest('a')).toHaveAttribute('href', 'https://what3words.com/filled.count.soap')
  })

  it('does not show what3words when not provided', async () => {
    mockGet.mockResolvedValue({
      data: { ...REPORT_WITH_IMAGES, what3words: '' },
    })
    renderReportDetail()
    await screen.findByText('Broken bottles near park')
    expect(screen.queryByText(/what3words/)).not.toBeInTheDocument()
  })

  /* ── Resolve form ────────────────────────────────── */

  it('shows Mark as Resolved button for pending reports', async () => {
    renderReportDetail()
    expect(await screen.findByRole('button', { name: /mark as resolved/i })).toBeInTheDocument()
  })

  it('opens resolve form when clicking Mark as Resolved', async () => {
    const user = userEvent.setup()
    renderReportDetail()

    await user.click(await screen.findByRole('button', { name: /mark as resolved/i }))

    expect(screen.getByText('Resolve Report')).toBeInTheDocument()
    expect(screen.getByText(/upload proof photos/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit resolution/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('shows name and email fields for anonymous users in resolve form', async () => {
    const user = userEvent.setup()
    renderReportDetail()

    await user.click(await screen.findByRole('button', { name: /mark as resolved/i }))

    expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
  })

  it('hides name and email fields for logged-in users in resolve form', async () => {
    mockAuth = { token: 'abc', canManageUsers: false, isLoggedIn: true }
    const user = userEvent.setup()
    renderReportDetail()

    await user.click(await screen.findByRole('button', { name: /mark as resolved/i }))

    expect(screen.queryByPlaceholderText('Enter your name')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Enter your email')).not.toBeInTheDocument()
  })

  it('can cancel the resolve form', async () => {
    const user = userEvent.setup()
    renderReportDetail()

    await user.click(await screen.findByRole('button', { name: /mark as resolved/i }))
    expect(screen.getByText('Resolve Report')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByText('Resolve Report')).not.toBeInTheDocument()
  })

  /* ── Resolved report ─────────────────────────────── */

  it('shows resolved banner for cleaned reports', async () => {
    mockGet.mockResolvedValue({ data: RESOLVED_REPORT })
    renderReportDetail('43')
    expect(await screen.findByText(/this report has been marked as cleaned/i)).toBeInTheDocument()
  })

  it('does not show Mark as Resolved for cleaned reports', async () => {
    mockGet.mockResolvedValue({ data: RESOLVED_REPORT })
    renderReportDetail('43')
    await screen.findByText(/Cleaned up bags/)
    expect(screen.queryByRole('button', { name: /mark as resolved/i })).not.toBeInTheDocument()
  })

  it('shows resolved date when available', async () => {
    mockGet.mockResolvedValue({ data: RESOLVED_REPORT })
    renderReportDetail('43')
    expect(await screen.findByText(/Resolved on/)).toBeInTheDocument()
  })

  it('shows Resolved label on resolved images', async () => {
    mockGet.mockResolvedValue({ data: RESOLVED_REPORT })
    renderReportDetail('43')
    await waitFor(() => {
      expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0)
    })
  })
})
