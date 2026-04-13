import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

/* ── mock data ─────────────────────────────────────────── */
const PLAN = {
  id: 'plan-1',
  user_id: 'user-1',
  name: 'Morning cleanup',
  start_latitude: 51.5,
  start_longitude: -0.1,
  status: 'planned',
  total_distance_meters: 2500,
  total_duration_seconds: 1800,
  route_geometry: null,
  google_maps_url: 'https://www.google.com/maps/dir/?api=1&origin=51.5,-0.1',
  created_at: '2026-03-01T10:00:00Z',
  updated_at: null,
  plan_reports: [
    {
      id: 'pr-1',
      report_id: 'r-1',
      visit_order: 1,
      leg_distance_meters: 800,
      leg_duration_seconds: 600,
      report: {
        id: 'r-1',
        description: 'Bottles on path',
        status: 'pending',
        latitude: 51.51,
        longitude: -0.09,
        created_at: '2026-01-01T00:00:00Z',
        what3words: 'fill.count.soap',
        images: [
          { id: 'img-1', image_type: 'report', url: 'img1.jpg', thumbnail_url: 'thumb1.jpg' },
        ],
      },
    },
    {
      id: 'pr-2',
      report_id: 'r-2',
      visit_order: 2,
      leg_distance_meters: 1700,
      leg_duration_seconds: 1200,
      report: {
        id: 'r-2',
        description: 'Cans in park',
        status: 'pending',
        latitude: 51.52,
        longitude: -0.08,
        created_at: '2026-01-02T00:00:00Z',
        what3words: '',
        images: [],
      },
    },
  ],
}

/* ── mocks ────────────────────────────────────────────── */
const mockGetPlan = jest.fn()
const mockUpdatePlan = jest.fn()
const mockStartPlan = jest.fn()
const mockCompletePlan = jest.fn()
const mockDeletePlan = jest.fn()

jest.mock('../../api/endpoints/planner/planner', () => ({
  getPlanner: () => ({
    getPlanApiPlannerPlanIdGet: (...args: unknown[]) => mockGetPlan(...args),
    updatePlanApiPlannerPlanIdPatch: (...args: unknown[]) => mockUpdatePlan(...args),
    startPlanApiPlannerPlanIdStartPatch: (...args: unknown[]) => mockStartPlan(...args),
    completePlanApiPlannerPlanIdCompletePatch: (...args: unknown[]) => mockCompletePlan(...args),
    deletePlanApiPlannerPlanIdDelete: (...args: unknown[]) => mockDeletePlan(...args),
  }),
}))

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isLoggedIn: true }),
}))

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  thumbnailUrl: (img: { thumbnail_url?: string; url: string }) => img.thumbnail_url || img.url,
  API_BASE_URL: '',
}))

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ position }: { position: [number, number] }) => (
    <div data-testid="marker" data-lat={position[0]} data-lng={position[1]} />
  ),
  GeoJSON: () => <div data-testid="geojson" />,
  useMap: () => ({
    fitBounds: jest.fn(),
  }),
}))

jest.mock('leaflet', () => ({
  icon: () => ({}),
  latLngBounds: () => ({ pad: jest.fn().mockReturnThis() }),
  latLng: (lat: number, lng: number) => ({ lat, lng }),
}))

import PlanDetail from '../PlanDetail'

function renderPlanDetail(planId = 'plan-1') {
  return render(
    <MemoryRouter initialEntries={[`/planner/${planId}`]}>
      <Routes>
        <Route path="/planner/:id" element={<PlanDetail />} />
        <Route path="/planner" element={<div data-testid="planner-list">Plan list</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PlanDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetPlan.mockResolvedValue(PLAN)
  })

  it('renders plan name and status', async () => {
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByText('Morning cleanup')).toBeInTheDocument()
    })
    expect(screen.getByText('Planned')).toBeInTheDocument()
  })

  it('renders the map', async () => {
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByTestId('map-container')).toBeInTheDocument()
    })
  })

  it('shows report stops in order', async () => {
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByText('Bottles on path')).toBeInTheDocument()
    })
    expect(screen.getByText('Cans in park')).toBeInTheDocument()
    expect(screen.getByText('Stops (2)')).toBeInTheDocument()
  })

  it('shows leg distances', async () => {
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByText('800 m walk')).toBeInTheDocument()
    })
    expect(screen.getByText('1.7 km walk')).toBeInTheDocument()
  })

  it('shows total distance and duration', async () => {
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByText('2.5 km')).toBeInTheDocument()
    })
    expect(screen.getByText('30 min')).toBeInTheDocument()
  })

  it('shows what3words when available', async () => {
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByText(/fill\.count\.soap/)).toBeInTheDocument()
    })
  })

  it('shows Start Plan button for planned status', async () => {
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start plan/i })).toBeInTheDocument()
    })
  })

  it('shows Complete Plan button for in_progress status', async () => {
    mockGetPlan.mockResolvedValue({ ...PLAN, status: 'in_progress' })
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /complete plan/i })).toBeInTheDocument()
    })
  })

  it('hides action buttons for completed status', async () => {
    mockGetPlan.mockResolvedValue({ ...PLAN, status: 'completed' })
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /start plan/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /complete plan/i })).not.toBeInTheDocument()
  })

  it('shows Google Maps link', async () => {
    renderPlanDetail()
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /open in google maps/i })
      expect(link).toHaveAttribute('href', PLAN.google_maps_url)
    })
  })

  it('shows Export GPX button', async () => {
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export gpx/i })).toBeInTheDocument()
    })
  })

  it('shows delete confirmation modal on delete click', async () => {
    const user = userEvent.setup()
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(screen.getByText(/delete this plan/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('can dismiss delete confirmation', async () => {
    const user = userEvent.setup()
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(screen.getByText(/delete this plan/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByText(/delete this plan/i)).not.toBeInTheDocument()
  })

  it('calls start plan API when clicking Start Plan', async () => {
    mockStartPlan.mockResolvedValue({ ...PLAN, status: 'in_progress' })
    const user = userEvent.setup()
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start plan/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /start plan/i }))
    expect(mockStartPlan).toHaveBeenCalledWith('plan-1')
  })

  it('shows edit button for plan name', async () => {
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    })
  })

  it('shows name edit form when clicking Edit', async () => {
    const user = userEvent.setup()
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByText('Morning cleanup')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /edit/i }))
    const input = screen.getByDisplayValue('Morning cleanup')
    expect(input).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('calls update API when saving name', async () => {
    mockUpdatePlan.mockResolvedValue({ ...PLAN, name: 'New name' })
    const user = userEvent.setup()
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByText('Morning cleanup')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /edit/i }))
    const input = screen.getByDisplayValue('Morning cleanup')
    await user.clear(input)
    await user.type(input, 'New name')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(mockUpdatePlan).toHaveBeenCalledWith('plan-1', { name: 'New name' })
  })

  it('shows back to plans link', async () => {
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByText(/back to plans/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/back to plans/i).closest('a')).toHaveAttribute('href', '/planner')
  })

  it('shows not found for missing plan', async () => {
    mockGetPlan.mockResolvedValue(null)
    renderPlanDetail()
    await waitFor(() => {
      expect(screen.getByText(/plan not found/i)).toBeInTheDocument()
    })
  })
})
