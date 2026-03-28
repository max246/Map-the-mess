import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CreateEvent from '../CreateEvent'

const mockNavigate = jest.fn()
const mockCreateEvent = jest.fn()
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
    createEventApiCommunitiesCommunityIdEventsPost: (...args: unknown[]) =>
      mockCreateEvent(...args),
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

function renderCreateEvent() {
  return render(
    <MemoryRouter initialEntries={['/communities/1/events/new']}>
      <Routes>
        <Route path="/communities/:id/events/new" element={<CreateEvent />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('CreateEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListCommunities.mockResolvedValue([
      { id: 1, name: 'Test Community', latitude: 53.5, longitude: -1.5, radius_km: 10 },
    ])
    mockListReports.mockResolvedValue([])
  })

  it('renders the page heading', () => {
    renderCreateEvent()
    expect(screen.getByRole('heading', { name: /new event/i })).toBeInTheDocument()
  })

  it('renders title input', () => {
    renderCreateEvent()
    expect(screen.getByPlaceholderText('Event title')).toBeInTheDocument()
  })

  it('renders description editor with Write/Preview tabs', () => {
    renderCreateEvent()
    expect(screen.getByRole('button', { name: /write/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument()
    expect(screen.getByText(/supports markdown/i)).toBeInTheDocument()
  })

  it('renders date & time input', () => {
    renderCreateEvent()
    expect(screen.getByText(/date & time/i)).toBeInTheDocument()
  })

  it('renders meeting point picker', () => {
    renderCreateEvent()
    expect(screen.getByTestId('meeting-point-picker')).toBeInTheDocument()
  })

  it('renders back to community link', () => {
    renderCreateEvent()
    const link = screen.getByRole('link', { name: /back to community/i })
    expect(link).toHaveAttribute('href', '/communities/1')
  })

  it('submit button is disabled when title is empty', () => {
    renderCreateEvent()
    const button = screen.getByRole('button', { name: /create event/i })
    expect(button).toBeDisabled()
  })

  it('shows markdown preview when Preview tab is clicked', async () => {
    const user = userEvent.setup()
    renderCreateEvent()

    await user.type(screen.getByPlaceholderText(/describe the event/i), '**bold text**')
    await user.click(screen.getByRole('button', { name: /preview/i }))

    expect(screen.getByTestId('markdown-renderer')).toHaveTextContent('**bold text**')
  })

  it('shows empty preview message when description is blank', async () => {
    const user = userEvent.setup()
    renderCreateEvent()

    await user.click(screen.getByRole('button', { name: /preview/i }))

    expect(screen.getByText(/nothing to preview/i)).toBeInTheDocument()
  })

  it('calls create event API on form submission', async () => {
    mockCreateEvent.mockResolvedValue({ id: 10 })
    const user = userEvent.setup()
    renderCreateEvent()

    await user.type(screen.getByPlaceholderText('Event title'), 'Beach Cleanup')
    await user.type(screen.getByPlaceholderText(/describe the event/i), 'Bring gloves')

    const dateInput = document.querySelector('input[type="datetime-local"]') as HTMLInputElement
    await user.type(dateInput, '2026-04-15T10:00')

    await user.click(screen.getByRole('button', { name: /create event/i }))

    expect(mockCreateEvent).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        title: 'Beach Cleanup',
        description: 'Bring gloves',
      })
    )
  })

  it('navigates back to community on successful creation', async () => {
    mockCreateEvent.mockResolvedValue({ id: 10 })
    const user = userEvent.setup()
    renderCreateEvent()

    await user.type(screen.getByPlaceholderText('Event title'), 'Beach Cleanup')

    const dateInput = document.querySelector('input[type="datetime-local"]') as HTMLInputElement
    await user.type(dateInput, '2026-04-15T10:00')

    await user.click(screen.getByRole('button', { name: /create event/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/communities/1')
  })

  it('shows error on failed creation', async () => {
    mockCreateEvent.mockRejectedValue({
      response: { data: { detail: 'Not authorized' } },
    })
    const user = userEvent.setup()
    renderCreateEvent()

    await user.type(screen.getByPlaceholderText('Event title'), 'Beach Cleanup')

    const dateInput = document.querySelector('input[type="datetime-local"]') as HTMLInputElement
    await user.type(dateInput, '2026-04-15T10:00')

    await user.click(screen.getByRole('button', { name: /create event/i }))

    expect(await screen.findByText('Not authorized')).toBeInTheDocument()
  })
})
