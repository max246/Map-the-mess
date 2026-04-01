import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import EditEvent from '../EditEvent'

const mockNavigate = jest.fn()
const mockUpdateEvent = jest.fn()
const mockGetEvent = jest.fn()
const mockListCommunities = jest.fn()
const mockListReports = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isLoggedIn: true }),
}))

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  thumbnailUrl: () => 'thumb.jpg',
}))

jest.mock('../../api/endpoints/communities/communities', () => ({
  getCommunities: () => ({
    listCommunitiesApiCommunitiesGet: (...args: unknown[]) => mockListCommunities(...args),
    getEventApiCommunitiesCommunityIdEventsEventIdGet: (...args: unknown[]) =>
      mockGetEvent(...args),
    updateEventApiCommunitiesCommunityIdEventsEventIdPatch: (...args: unknown[]) =>
      mockUpdateEvent(...args),
  }),
}))

jest.mock('../../api/endpoints/reports/reports', () => ({
  getReports: () => ({
    listReportsApiReportsGet: (...args: unknown[]) => mockListReports(...args),
  }),
}))

jest.mock('../../components/MeetingPointPicker', () => () => (
  <div data-testid="meeting-point-picker" />
))

jest.mock('../../components/MarkdownRenderer', () => ({ content }: { content: string }) => (
  <div data-testid="markdown-renderer">{content}</div>
))

const EXISTING_EVENT = {
  id: '00000000-0000-0000-0000-000000000005',
  community_id: '00000000-0000-0000-0000-000000000001',
  title: 'Park Cleanup',
  description: 'Bring **gloves** and bags',
  date: '2026-04-20T09:00:00Z',
  meeting_latitude: 53.5,
  meeting_longitude: -1.5,
  report_ids: ['00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020'],
  created_at: '2026-03-01T12:00:00Z',
}

function renderEditEvent() {
  return render(
    <MemoryRouter
      initialEntries={[
        '/communities/00000000-0000-0000-0000-000000000001/events/00000000-0000-0000-0000-000000000005/edit',
      ]}
    >
      <Routes>
        <Route path="/communities/:id/events/:eventId/edit" element={<EditEvent />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('EditEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListCommunities.mockResolvedValue([
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Test Community',
        latitude: 53.5,
        longitude: -1.5,
        radius_km: 10,
      },
    ])
    mockListReports.mockResolvedValue([])
    mockGetEvent.mockResolvedValue(EXISTING_EVENT)
  })

  it('renders the page heading', async () => {
    renderEditEvent()
    expect(await screen.findByRole('heading', { name: /edit event/i })).toBeInTheDocument()
  })

  it('populates the title field from the event', async () => {
    renderEditEvent()
    const input = await screen.findByDisplayValue('Park Cleanup')
    expect(input).toBeInTheDocument()
  })

  it('populates the description field from the event', async () => {
    renderEditEvent()
    const textarea = await screen.findByDisplayValue('Bring **gloves** and bags')
    expect(textarea).toBeInTheDocument()
  })

  it('renders Write/Preview tabs', async () => {
    renderEditEvent()
    expect(await screen.findByRole('button', { name: /write/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument()
  })

  it('shows markdown preview of existing description', async () => {
    const user = userEvent.setup()
    renderEditEvent()

    await screen.findByDisplayValue('Park Cleanup')
    await user.click(screen.getByRole('button', { name: /preview/i }))

    expect(screen.getByTestId('markdown-renderer')).toHaveTextContent('Bring **gloves** and bags')
  })

  it('renders meeting point picker', async () => {
    renderEditEvent()
    expect(await screen.findByTestId('meeting-point-picker')).toBeInTheDocument()
  })

  it('calls update event API on form submission', async () => {
    mockUpdateEvent.mockResolvedValue(EXISTING_EVENT)
    const user = userEvent.setup()
    renderEditEvent()

    const titleInput = await screen.findByDisplayValue('Park Cleanup')
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated Cleanup')

    await user.click(screen.getByRole('button', { name: /update event/i }))

    expect(mockUpdateEvent).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000005',
      expect.objectContaining({ title: 'Updated Cleanup' })
    )
  })

  it('navigates back to community on successful update', async () => {
    mockUpdateEvent.mockResolvedValue(EXISTING_EVENT)
    const user = userEvent.setup()
    renderEditEvent()

    await screen.findByDisplayValue('Park Cleanup')
    await user.click(screen.getByRole('button', { name: /update event/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/communities/00000000-0000-0000-0000-000000000001')
  })

  it('shows error on failed update', async () => {
    mockUpdateEvent.mockRejectedValue({
      response: { data: { detail: 'Forbidden' } },
    })
    const user = userEvent.setup()
    renderEditEvent()

    await screen.findByDisplayValue('Park Cleanup')
    await user.click(screen.getByRole('button', { name: /update event/i }))

    expect(await screen.findByText('Forbidden')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    // Make the event request never resolve
    mockGetEvent.mockReturnValue(new Promise(() => {}))
    renderEditEvent()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows error state when event fails to load', async () => {
    mockGetEvent.mockRejectedValue(new Error('Network error'))
    renderEditEvent()
    expect(await screen.findByText(/failed to load event/i)).toBeInTheDocument()
  })
})
