import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockListReports = jest.fn()
const mockVolunteerCount = jest.fn()

jest.mock('../../api/endpoints/reports/reports', () => ({
  getReports: () => ({
    listReportsApiReportsGet: (...args: unknown[]) => mockListReports(...args),
  }),
}))

jest.mock('../../api/endpoints/volunteers/volunteers', () => ({
  getVolunteers: () => ({
    volunteerCountApiVolunteersCountGet: (...args: unknown[]) => mockVolunteerCount(...args),
  }),
}))

import Home from '../Home'

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  )
}

describe('Home', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListReports.mockResolvedValue([])
    mockVolunteerCount.mockResolvedValue({ count: 0 })
  })

  it('renders the page title', () => {
    renderHome()
    expect(screen.getByRole('heading', { name: /map the mess/i })).toBeInTheDocument()
  })

  it('shows the tagline', () => {
    renderHome()
    expect(screen.getByText(/spot litter\? report it/i)).toBeInTheDocument()
  })

  it('has a link to report litter', () => {
    renderHome()
    const link = screen.getByRole('link', { name: /report litter/i })
    expect(link).toHaveAttribute('href', '/report')
  })

  it('has a link to view map', () => {
    renderHome()
    const link = screen.getByRole('link', { name: /view map/i })
    expect(link).toHaveAttribute('href', '/map')
  })

  it('displays stats section', () => {
    renderHome()
    expect(screen.getByText('Reports')).toBeInTheDocument()
    expect(screen.getByText('Cleaned')).toBeInTheDocument()
    expect(screen.getByText('Volunteers')).toBeInTheDocument()
  })

  it('fetches and displays report stats', async () => {
    mockListReports.mockResolvedValue([
      { id: 1, description: 'Litter A', status: 'reported', created_at: '2026-01-01' },
      { id: 2, description: 'Litter B', status: 'cleaned', created_at: '2026-01-02' },
      { id: 3, description: 'Litter C', status: 'reported', created_at: '2026-01-03' },
    ])
    mockVolunteerCount.mockResolvedValue({ count: 5 })
    renderHome()

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument() // reports
      expect(screen.getByText('1')).toBeInTheDocument() // cleaned
      expect(screen.getByText('5')).toBeInTheDocument() // volunteers
    })
  })

  it('shows recent reports when data is loaded', async () => {
    mockListReports.mockResolvedValue([
      {
        id: 1,
        description: 'Broken bottles near park',
        status: 'reported',
        created_at: '2026-01-01',
      },
    ])
    mockVolunteerCount.mockResolvedValue({ count: 0 })
    renderHome()

    expect(await screen.findByText('Recent Reports')).toBeInTheDocument()
    expect(screen.getByText('Broken bottles near park')).toBeInTheDocument()
  })

  it('links each report to its detail page', async () => {
    mockListReports.mockResolvedValue([
      { id: 42, description: 'Test report', status: 'reported', created_at: '2026-01-01' },
    ])
    mockVolunteerCount.mockResolvedValue({ count: 0 })
    renderHome()

    const link = await screen.findByRole('link', { name: /test report/i })
    expect(link).toHaveAttribute('href', '/report/42')
  })

  it('does not show recent reports section when empty', () => {
    renderHome()
    expect(screen.queryByText('Recent Reports')).not.toBeInTheDocument()
  })

  it('shows what3words address when available', async () => {
    mockListReports.mockResolvedValue([
      {
        id: 1,
        description: 'Some litter',
        status: 'reported',
        created_at: '2026-01-01',
        what3words: 'filled.count.soap',
      },
    ])
    mockVolunteerCount.mockResolvedValue({ count: 0 })
    renderHome()

    expect(await screen.findByText(/filled\.count\.soap/)).toBeInTheDocument()
  })
})
