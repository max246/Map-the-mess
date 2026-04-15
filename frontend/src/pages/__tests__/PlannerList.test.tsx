import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

/* ── mock data ─────────────────────────────────────────── */
const PLANS = [
  {
    id: 'plan-1',
    name: 'Morning cleanup',
    start_latitude: 51.5,
    start_longitude: -0.1,
    status: 'planned',
    total_distance_meters: 2500,
    total_duration_seconds: 1800,
    report_count: 3,
    created_at: '2026-03-01T10:00:00Z',
  },
  {
    id: 'plan-2',
    name: null,
    start_latitude: 52.0,
    start_longitude: -1.0,
    status: 'in_progress',
    total_distance_meters: 5200,
    total_duration_seconds: 3900,
    report_count: 5,
    created_at: '2026-03-05T14:00:00Z',
  },
  {
    id: 'plan-3',
    name: 'Park route',
    start_latitude: 53.0,
    start_longitude: -2.0,
    status: 'completed',
    total_distance_meters: 800,
    total_duration_seconds: 600,
    report_count: 2,
    created_at: '2026-02-20T08:00:00Z',
  },
]

/* ── mocks ────────────────────────────────────────────── */
const mockListPlans = jest.fn()

jest.mock('../../api/endpoints/planner/planner', () => ({
  getPlanner: () => ({
    listPlansApiPlannerGet: (...args: unknown[]) => mockListPlans(...args),
  }),
}))

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isLoggedIn: true }),
}))

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

import PlannerList from '../PlannerList'

function renderPlannerList() {
  return render(
    <MemoryRouter>
      <PlannerList />
    </MemoryRouter>
  )
}

describe('PlannerList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListPlans.mockResolvedValue(PLANS)
  })

  it('renders the page heading and create button', async () => {
    renderPlannerList()
    expect(screen.getByRole('heading', { name: /route planner/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create plan/i })).toBeInTheDocument()
  })

  it('shows all plans on load', async () => {
    renderPlannerList()
    await waitFor(() => {
      expect(screen.getByText('Morning cleanup')).toBeInTheDocument()
    })
    expect(screen.getByText('Untitled plan')).toBeInTheDocument()
    expect(screen.getByText('Park route')).toBeInTheDocument()
  })

  it('shows status badges', async () => {
    renderPlannerList()
    await waitFor(() => {
      // Status badges inside plan cards (there are also tab buttons with the same text)
      const badges = screen.getAllByText('Planned')
      expect(badges.length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(2) // tab + badge
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(2) // tab + badge
  })

  it('shows report count for each plan', async () => {
    renderPlannerList()
    await waitFor(() => {
      expect(screen.getByText('3 reports')).toBeInTheDocument()
    })
    expect(screen.getByText('5 reports')).toBeInTheDocument()
    expect(screen.getByText('2 reports')).toBeInTheDocument()
  })

  it('formats distance correctly', async () => {
    renderPlannerList()
    await waitFor(() => {
      expect(screen.getByText('2.5 km')).toBeInTheDocument()
    })
    expect(screen.getByText('5.2 km')).toBeInTheDocument()
    expect(screen.getByText('800 m')).toBeInTheDocument()
  })

  it('formats duration correctly', async () => {
    renderPlannerList()
    await waitFor(() => {
      expect(screen.getByText('30 min')).toBeInTheDocument()
    })
    expect(screen.getByText('1h 5m')).toBeInTheDocument()
    expect(screen.getByText('10 min')).toBeInTheDocument()
  })

  it('filters by status tab', async () => {
    const user = userEvent.setup()
    renderPlannerList()
    await waitFor(() => {
      expect(screen.getByText('Morning cleanup')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'In Progress' }))
    expect(screen.getByText('Untitled plan')).toBeInTheDocument()
    expect(screen.queryByText('Morning cleanup')).not.toBeInTheDocument()
    expect(screen.queryByText('Park route')).not.toBeInTheDocument()
  })

  it('shows empty state when no plans match filter', async () => {
    mockListPlans.mockResolvedValue([])
    renderPlannerList()
    await waitFor(() => {
      expect(screen.getByText(/no plans yet/i)).toBeInTheDocument()
    })
  })

  it('shows empty state for filtered tab with no matches', async () => {
    mockListPlans.mockResolvedValue([PLANS[0]]) // only 'planned'
    const user = userEvent.setup()
    renderPlannerList()
    await waitFor(() => {
      expect(screen.getByText('Morning cleanup')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Completed' }))
    expect(screen.getByText(/no completed plans/i)).toBeInTheDocument()
  })

  it('links plans to detail page', async () => {
    renderPlannerList()
    await waitFor(() => {
      expect(screen.getByText('Morning cleanup')).toBeInTheDocument()
    })
    const link = screen.getByText('Morning cleanup').closest('a')
    expect(link).toHaveAttribute('href', '/planner/plan-1')
  })
})
