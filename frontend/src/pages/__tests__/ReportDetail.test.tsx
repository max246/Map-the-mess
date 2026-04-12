import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ReportDetail from '../ReportDetail'

/* ── mock data ─────────────────────────────────────────── */
const REPORT_WITH_IMAGES = {
  id: '00000000-0000-0000-0000-00000000ab42',
  description: 'Broken bottles near park',
  status: 'reported',
  latitude: 51.50735,
  longitude: -0.12776,
  created_at: '2026-01-15T10:30:00Z',
  what3words: 'filled.count.soap',
  address: '123 Test Street, London',
  resolved_at: null,
  current_cycle: 0,
  status_log: [
    {
      id: 'log-1',
      action: 'created',
      cycle: 0,
      performed_by_user_id: null,
      created_at: '2026-01-15T10:30:00Z',
    },
  ],
  images: [
    {
      id: '00000000-0000-0000-0000-000000000101',
      image_type: 'report',
      path: 'images/101.jpg',
      url: '101.jpg',
      cycle: 0,
      created_at: '2026-01-15T10:30:00Z',
    },
    {
      id: '00000000-0000-0000-0000-000000000102',
      image_type: 'report',
      path: 'images/102.jpg',
      url: '102.jpg',
      cycle: 0,
      created_at: '2026-01-15T10:31:00Z',
    },
  ],
}

const RESOLVED_REPORT = {
  id: '00000000-0000-0000-0000-00000000cd43',
  description: 'Cleaned up bags',
  status: 'cleaned',
  latitude: 52.0,
  longitude: -1.0,
  created_at: '2026-01-10T08:00:00Z',
  what3words: '',
  resolved_at: '2026-01-12T14:00:00Z',
  current_cycle: 0,
  status_log: [
    {
      id: 'log-2',
      action: 'created',
      cycle: 0,
      performed_by_user_id: null,
      created_at: '2026-01-10T08:00:00Z',
    },
    {
      id: 'log-3',
      action: 'cleaned',
      cycle: 0,
      performed_by_user_id: 'user-1',
      created_at: '2026-01-12T14:00:00Z',
    },
  ],
  images: [
    {
      id: '00000000-0000-0000-0000-000000000201',
      image_type: 'report',
      path: 'images/201.jpg',
      url: '201.jpg',
      cycle: 0,
      created_at: '2026-01-10T08:00:00Z',
    },
    {
      id: '00000000-0000-0000-0000-000000000202',
      image_type: 'resolved',
      path: 'images/202.jpg',
      url: '202.jpg',
      cycle: 0,
      created_at: '2026-01-12T14:00:00Z',
    },
  ],
}

const REOPENED_REPORT = {
  id: '00000000-0000-0000-0000-00000000ef44',
  description: 'Reopened mess',
  status: 'reported',
  latitude: 51.5,
  longitude: -0.1,
  created_at: '2026-01-01T08:00:00Z',
  what3words: '',
  address: '456 Test Road',
  resolved_at: null,
  current_cycle: 1,
  status_log: [
    {
      id: 'log-4',
      action: 'created',
      cycle: 0,
      performed_by_user_id: null,
      created_at: '2026-01-01T08:00:00Z',
    },
    {
      id: 'log-5',
      action: 'cleaned',
      cycle: 0,
      performed_by_user_id: 'user-1',
      created_at: '2026-01-05T12:00:00Z',
    },
    {
      id: 'log-6',
      action: 'reopened',
      cycle: 1,
      performed_by_user_id: null,
      created_at: '2026-01-10T09:00:00Z',
    },
  ],
  images: [
    {
      id: '00000000-0000-0000-0000-000000000301',
      image_type: 'report',
      url: '301.jpg',
      cycle: 0,
      created_at: '2026-01-01T08:00:00Z',
    },
    {
      id: '00000000-0000-0000-0000-000000000302',
      image_type: 'resolved',
      url: '302.jpg',
      cycle: 0,
      created_at: '2026-01-05T12:00:00Z',
    },
    {
      id: '00000000-0000-0000-0000-000000000303',
      image_type: 'report',
      url: '303.jpg',
      cycle: 1,
      created_at: '2026-01-10T09:00:00Z',
    },
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

jest.mock('../../components/LocateButton', () => () => <button data-testid="locate-button" />)

function renderReportDetail(reportId: string = '00000000-0000-0000-0000-00000000ab42') {
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
    renderReportDetail('00000000-0000-0000-0000-00000000cd43')
    await waitFor(() => {
      expect(screen.getByText(/Cleaned up bags/i)).toBeInTheDocument()
    })
    const addButtons = screen.getAllByRole('button').filter((btn) => btn.textContent === '+')
    expect(addButtons).toHaveLength(0)
  })

  /* ── Report details ─────────────────────────────── */

  it('shows the report title with ID', async () => {
    renderReportDetail()
    expect(await screen.findByText(/Report #00ab42/)).toBeInTheDocument()
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

  it('shows upload progress bar when resolving with photos', async () => {
    mockAuth = { token: 'test-token', canManageUsers: false, isLoggedIn: true }

    // Make post stay pending but call onUploadProgress
    mockPost.mockImplementation((...args: unknown[]) => {
      const config = args[2] as
        | { onUploadProgress?: (e: { loaded: number; total: number }) => void }
        | undefined
      if (config?.onUploadProgress) {
        config.onUploadProgress({ loaded: 30, total: 100 })
      }
      return new Promise(() => {}) // never resolves
    })

    const user = userEvent.setup()
    renderReportDetail()

    // Open resolve form
    await user.click(await screen.findByRole('button', { name: /mark as resolved/i }))

    // Add a fake photo via the file input — click the upload area to trigger it
    const file = new File(['photo'], 'proof.jpg', { type: 'image/jpeg' })
    const fileInputs = document.querySelectorAll('input[type="file"]')
    // The resolve form's file input is the last one on the page
    const resolveFileInput = fileInputs[fileInputs.length - 1] as HTMLInputElement
    await user.upload(resolveFileInput, file)

    // Submit
    await user.click(screen.getByRole('button', { name: /submit resolution/i }))

    // Progress bar should be visible
    await waitFor(() => {
      expect(screen.getByText(/uploading photo 1 of 1/i)).toBeInTheDocument()
      expect(screen.getByText(/30%/)).toBeInTheDocument()
    })

    // Submit and cancel buttons should be gone
    expect(screen.queryByRole('button', { name: /submit resolution/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
  })

  /* ── Resolved report ─────────────────────────────── */

  it('shows resolved banner for cleaned reports', async () => {
    mockGet.mockResolvedValue({ data: RESOLVED_REPORT })
    renderReportDetail('00000000-0000-0000-0000-00000000cd43')
    expect(await screen.findByText(/this report has been marked as cleaned/i)).toBeInTheDocument()
  })

  it('does not show Mark as Resolved for cleaned reports', async () => {
    mockGet.mockResolvedValue({ data: RESOLVED_REPORT })
    renderReportDetail('00000000-0000-0000-0000-00000000cd43')
    await screen.findByText(/Cleaned up bags/)
    expect(screen.queryByRole('button', { name: /mark as resolved/i })).not.toBeInTheDocument()
  })

  it('shows resolved date when available', async () => {
    mockGet.mockResolvedValue({ data: RESOLVED_REPORT })
    renderReportDetail('00000000-0000-0000-0000-00000000cd43')
    expect(await screen.findByText(/Resolved on/)).toBeInTheDocument()
  })

  it('shows Resolved label on resolved images', async () => {
    mockGet.mockResolvedValue({ data: RESOLVED_REPORT })
    renderReportDetail('00000000-0000-0000-0000-00000000cd43')
    await waitFor(() => {
      expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0)
    })
  })

  /* ── Status timeline ────────────────────────────── */

  it('shows History section with timeline entries', async () => {
    renderReportDetail()
    expect(await screen.findByText('History')).toBeInTheDocument()
    expect(screen.getByText('Reported')).toBeInTheDocument()
  })

  it('shows timeline with multiple entries for resolved report', async () => {
    mockGet.mockResolvedValue({ data: RESOLVED_REPORT })
    renderReportDetail('00000000-0000-0000-0000-00000000cd43')
    expect(await screen.findByText('History')).toBeInTheDocument()
    expect(screen.getByText('Reported')).toBeInTheDocument()
    // "Resolved" appears in the timeline and also in the resolved banner/badge
    expect(screen.getAllByText('Resolved').length).toBeGreaterThanOrEqual(2)
  })

  it('shows timeline with Reopened entry for reopened report', async () => {
    mockGet.mockResolvedValue({ data: REOPENED_REPORT })
    renderReportDetail('00000000-0000-0000-0000-00000000ef44')
    expect(await screen.findByText('History')).toBeInTheDocument()
    expect(screen.getByText('Reported')).toBeInTheDocument()
    expect(screen.getByText('Reopened')).toBeInTheDocument()
  })

  /* ── Cycle-based image filtering ────────────────── */

  it('only shows current cycle images in main gallery for reopened report', async () => {
    mockGet.mockResolvedValue({ data: REOPENED_REPORT })
    renderReportDetail('00000000-0000-0000-0000-00000000ef44')
    await waitFor(() => {
      // Only cycle 1 image (303.jpg) should be in the main gallery
      const thumbnails = screen
        .getAllByRole('img')
        .filter((img) => img.getAttribute('alt')?.startsWith('Thumbnail'))
      expect(thumbnails).toHaveLength(1)
    })
  })

  it('shows "View photos from this period" link for old cycle images', async () => {
    mockGet.mockResolvedValue({ data: REOPENED_REPORT })
    renderReportDetail('00000000-0000-0000-0000-00000000ef44')
    const links = await screen.findAllByText(/View 2 photos from this period/)
    expect(links.length).toBeGreaterThan(0)
  })

  it('expands old cycle photos when clicking view link', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue({ data: REOPENED_REPORT })
    renderReportDetail('00000000-0000-0000-0000-00000000ef44')

    const viewLinks = await screen.findAllByText(/View 2 photos from this period/)
    await user.click(viewLinks[0])

    // Should now show old cycle thumbnails and a "Hide photos" link
    const hideLinks = screen.getAllByText('Hide photos')
    expect(hideLinks.length).toBeGreaterThan(0)
    const prevCycleImages = screen.getAllByAltText('Previous cycle')
    expect(prevCycleImages.length).toBeGreaterThanOrEqual(2)
  })

  /* ── Reopen form ────────────────────────────────── */

  it('shows reopen button for resolved reports', async () => {
    mockGet.mockResolvedValue({ data: RESOLVED_REPORT })
    renderReportDetail('00000000-0000-0000-0000-00000000cd43')
    expect(
      await screen.findByRole('button', { name: /report still dirty\? reopen/i })
    ).toBeInTheDocument()
  })

  it('opens reopen form with optional photo upload', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue({ data: RESOLVED_REPORT })
    renderReportDetail('00000000-0000-0000-0000-00000000cd43')

    await user.click(await screen.findByRole('button', { name: /report still dirty\? reopen/i }))

    expect(screen.getByText(/if this area is still dirty/i)).toBeInTheDocument()
    expect(screen.getByText(/add a photo \(optional\)/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reopen report/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('can cancel the reopen form', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue({ data: RESOLVED_REPORT })
    renderReportDetail('00000000-0000-0000-0000-00000000cd43')

    await user.click(await screen.findByRole('button', { name: /report still dirty\? reopen/i }))
    expect(screen.getByRole('button', { name: /reopen report/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('button', { name: /reopen report/i })).not.toBeInTheDocument()
  })

  it('calls unresolve API when submitting reopen without photo', async () => {
    mockAuth = { token: null, canManageUsers: false, isLoggedIn: false }
    mockPatch.mockResolvedValue({
      data: { ...RESOLVED_REPORT, status: 'pending', current_cycle: 1 },
    })
    const user = userEvent.setup()
    mockGet.mockResolvedValue({ data: RESOLVED_REPORT })
    renderReportDetail('00000000-0000-0000-0000-00000000cd43')

    await user.click(await screen.findByRole('button', { name: /report still dirty\? reopen/i }))
    await user.click(screen.getByRole('button', { name: /reopen report/i }))

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/api/reports/00000000-0000-0000-0000-00000000cd43/unresolve',
        undefined,
        expect.objectContaining({ headers: expect.any(Object) })
      )
    })
  })
})
