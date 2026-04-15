import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

/* ── mock data ─────────────────────────────────────────── */
const REPORTS = [
  {
    id: 'r-1',
    description: 'Bottles on path',
    status: 'pending',
    latitude: 51.5,
    longitude: -0.1,
    created_at: '2026-01-01T00:00:00Z',
    what3words: '',
    images: [],
  },
  {
    id: 'r-2',
    description: 'Cans in park',
    status: 'pending',
    latitude: 52.0,
    longitude: -1.0,
    created_at: '2026-01-02T00:00:00Z',
    what3words: '',
    images: [],
  },
]

const CREATED_PLAN = {
  id: 'new-plan-1',
  name: 'Test route',
  start_latitude: 51.5,
  start_longitude: -0.1,
  status: 'planned',
  created_at: '2026-03-10T10:00:00Z',
  plan_reports: [],
}

/* ── mocks ────────────────────────────────────────────── */
const mockListReports = jest.fn()
const mockCreatePlan = jest.fn()
const mockNavigate = jest.fn()

jest.mock('../../api/endpoints/reports/reports', () => ({
  getReports: () => ({
    listReportsApiReportsGet: (...args: unknown[]) => mockListReports(...args),
  }),
}))

jest.mock('../../api/endpoints/planner/planner', () => ({
  getPlanner: () => ({
    createPlanApiPlannerPost: (...args: unknown[]) => mockCreatePlan(...args),
  }),
}))

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isLoggedIn: true }),
}))

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({
    children,
    eventHandlers,
    position,
  }: {
    children?: React.ReactNode
    eventHandlers?: { click?: () => void }
    position: [number, number]
  }) => (
    <div
      data-testid="marker"
      data-lat={position[0]}
      data-lng={position[1]}
      onClick={eventHandlers?.click}
    >
      {children}
    </div>
  ),
  useMap: () => ({
    flyTo: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  }),
  useMapEvents: () => null,
}))

jest.mock('leaflet', () => ({
  icon: () => ({}),
  latLngBounds: () => ({}),
  latLng: () => ({}),
}))

jest.mock('../../components/LocateButton', () => () => <button data-testid="locate-button" />)

import CreatePlan from '../CreatePlan'

function renderCreatePlan() {
  return render(
    <MemoryRouter>
      <CreatePlan />
    </MemoryRouter>
  )
}

describe('CreatePlan', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListReports.mockResolvedValue(REPORTS)
    mockCreatePlan.mockResolvedValue(CREATED_PLAN)
  })

  it('renders the page heading and map', async () => {
    renderCreatePlan()
    expect(screen.getByRole('heading', { name: /create plan/i })).toBeInTheDocument()
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('shows the plan name input', () => {
    renderCreatePlan()
    expect(screen.getByPlaceholderText(/plan name/i)).toBeInTheDocument()
  })

  it('shows selection counter', () => {
    renderCreatePlan()
    expect(screen.getByText('0/10 selected')).toBeInTheDocument()
  })

  it('shows start point instruction banner', () => {
    renderCreatePlan()
    expect(screen.getByText(/click the map to set your starting point/i)).toBeInTheDocument()
  })

  it('loads unresolved reports', async () => {
    renderCreatePlan()
    await waitFor(() => {
      expect(mockListReports).toHaveBeenCalledWith({ status: 'pending' })
    })
  })

  it('renders report markers on the map', async () => {
    renderCreatePlan()
    await waitFor(() => {
      expect(screen.getAllByTestId('marker')).toHaveLength(2)
    })
  })

  it('toggles report selection when clicking a marker', async () => {
    const user = userEvent.setup()
    renderCreatePlan()
    await waitFor(() => {
      expect(screen.getAllByTestId('marker')).toHaveLength(2)
    })

    await user.click(screen.getAllByTestId('marker')[0])
    expect(screen.getByText('1/10 selected')).toBeInTheDocument()

    await user.click(screen.getAllByTestId('marker')[0])
    expect(screen.getByText('0/10 selected')).toBeInTheDocument()
  })

  it('has cancel button linking back', () => {
    renderCreatePlan()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('create button is disabled when no reports selected', () => {
    renderCreatePlan()
    expect(screen.getByRole('button', { name: /create plan/i })).toBeDisabled()
  })

  it('shows locate button', () => {
    renderCreatePlan()
    expect(screen.getByTestId('locate-button')).toBeInTheDocument()
  })
})
