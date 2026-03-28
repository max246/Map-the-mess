import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import EventDetail from '../EventDetail'

const mockNavigate = jest.fn()
const mockGetEvent = jest.fn()
const mockGetCommunity = jest.fn()
const mockDeleteEvent = jest.fn()
const mockListReports = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1 } }),
}))

jest.mock('../../api/endpoints/communities/communities', () => ({
  getCommunities: () => ({
    getEventApiCommunitiesCommunityIdEventsEventIdGet: (...args: unknown[]) =>
      mockGetEvent(...args),
    getCommunityApiCommunitiesCommunityIdGet: (...args: unknown[]) => mockGetCommunity(...args),
    deleteEventApiCommunitiesCommunityIdEventsEventIdDelete: (...args: unknown[]) =>
      mockDeleteEvent(...args),
  }),
}))

jest.mock('../../api/endpoints/reports/reports', () => ({
  getReports: () => ({
    listReportsApiReportsGet: (...args: unknown[]) => mockListReports(...args),
  }),
}))

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  thumbnailUrl: (img: { url: string }) => img.url,
}))

// Mock leaflet components
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ fitBounds: jest.fn() }),
}))

jest.mock('leaflet', () => ({
  icon: jest.fn(() => ({})),
  latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
}))

jest.mock('../../components/LocateButton', () => () => null)

jest.mock('../../components/MarkdownRenderer', () => ({ content }: { content: string }) => (
  <div data-testid="markdown-renderer">{content}</div>
))

const FUTURE_EVENT = {
  id: 5,
  community_id: 1,
  title: 'Beach Cleanup',
  description: 'Bring gloves and bags',
  date: '2099-04-20T09:00:00Z',
  meeting_latitude: 53.5,
  meeting_longitude: -1.5,
  report_ids: [],
  created_at: '2026-03-01T12:00:00Z',
}

const PAST_EVENT = {
  ...FUTURE_EVENT,
  title: 'Old Cleanup',
  date: '2020-01-01T09:00:00Z',
}

const COMMUNITY = {
  id: 1,
  name: 'Test Community',
  owner_id: 1,
  latitude: 53.5,
  longitude: -1.5,
  radius_km: 10,
}

function renderEventDetail() {
  return render(
    <MemoryRouter initialEntries={['/communities/1/events/5']}>
      <Routes>
        <Route path="/communities/:id/events/:eventId" element={<EventDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('EventDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetEvent.mockResolvedValue(FUTURE_EVENT)
    mockGetCommunity.mockResolvedValue(COMMUNITY)
    mockListReports.mockResolvedValue([])
  })

  it('displays the event title as heading', async () => {
    renderEventDetail()
    expect(await screen.findByRole('heading', { name: 'Beach Cleanup' })).toBeInTheDocument()
  })

  it('renders description with MarkdownRenderer', async () => {
    renderEventDetail()
    const renderer = await screen.findByTestId('markdown-renderer')
    expect(renderer).toHaveTextContent('Bring gloves and bags')
  })

  it('does not render description section when description is null', async () => {
    mockGetEvent.mockResolvedValue({ ...FUTURE_EVENT, description: null })
    renderEventDetail()
    await screen.findByRole('heading', { name: 'Beach Cleanup' })
    expect(screen.queryByTestId('markdown-renderer')).not.toBeInTheDocument()
  })

  it('displays formatted date and time', async () => {
    renderEventDetail()
    await screen.findByRole('heading', { name: 'Beach Cleanup' })
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Time')).toBeInTheDocument()
  })

  it('shows Past badge for past events', async () => {
    mockGetEvent.mockResolvedValue(PAST_EVENT)
    renderEventDetail()
    expect(await screen.findByText('Past')).toBeInTheDocument()
  })

  it('does not show Past badge for future events', async () => {
    renderEventDetail()
    await screen.findByRole('heading', { name: 'Beach Cleanup' })
    expect(screen.queryByText('Past')).not.toBeInTheDocument()
  })

  it('shows Edit and Delete buttons for owner', async () => {
    renderEventDetail()
    expect(await screen.findByRole('link', { name: /edit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('hides Edit and Delete buttons for non-owner', async () => {
    mockGetCommunity.mockResolvedValue({ ...COMMUNITY, owner_id: 999 })
    renderEventDetail()
    await screen.findByRole('heading', { name: 'Beach Cleanup' })
    expect(screen.queryByRole('link', { name: /edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('renders back to community link', async () => {
    renderEventDetail()
    const link = await screen.findByRole('link', { name: /back to community/i })
    expect(link).toHaveAttribute('href', '/communities/1')
  })

  it('shows meeting point coordinates', async () => {
    renderEventDetail()
    await screen.findByRole('heading', { name: 'Beach Cleanup' })
    expect(screen.getByText(/53\.50000/)).toBeInTheDocument()
    expect(screen.getByText(/-1\.50000/)).toBeInTheDocument()
  })

  it('shows loading state', () => {
    mockGetEvent.mockReturnValue(new Promise(() => {}))
    mockGetCommunity.mockReturnValue(new Promise(() => {}))
    renderEventDetail()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows error state when event not found', async () => {
    mockGetEvent.mockRejectedValue(new Error('Not found'))
    renderEventDetail()
    expect(await screen.findByText('Event not found')).toBeInTheDocument()
  })

  it('renders the map', async () => {
    renderEventDetail()
    expect(await screen.findByTestId('map')).toBeInTheDocument()
  })

  it('shows reports linked count', async () => {
    renderEventDetail()
    await screen.findByRole('heading', { name: 'Beach Cleanup' })
    expect(screen.getByText('Reports linked')).toBeInTheDocument()
  })
})
