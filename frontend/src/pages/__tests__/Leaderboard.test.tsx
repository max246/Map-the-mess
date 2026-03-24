import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockApiGet = jest.fn()
jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockApiGet(...args) },
}))

import Leaderboard from '../Leaderboard'

const MOCK_ENTRIES = [
  { rank: 1, name: 'Alice Smith', cleaned_count: 12 },
  { rank: 2, name: 'Bob Jones', cleaned_count: 9 },
  { rank: 3, name: 'Charlie Taylor', cleaned_count: 7 },
  { rank: 4, name: 'Dana Brown', cleaned_count: 3 },
]

function renderLeaderboard() {
  return render(
    <MemoryRouter>
      <Leaderboard />
    </MemoryRouter>
  )
}

describe('Leaderboard', () => {
  const mockWriteText = jest.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    jest.clearAllMocks()
    mockWriteText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    })
  })

  it('renders the page heading', () => {
    mockApiGet.mockResolvedValue({ data: [] })
    renderLeaderboard()
    expect(screen.getByRole('heading', { name: /leaderboard/i })).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    mockApiGet.mockReturnValue(new Promise(() => {})) // never resolves
    renderLeaderboard()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows the current month in the subtitle', () => {
    mockApiGet.mockResolvedValue({ data: [] })
    const monthName = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    renderLeaderboard()
    expect(screen.getByText(new RegExp(monthName))).toBeInTheDocument()
  })

  it('shows empty state when no entries', async () => {
    mockApiGet.mockResolvedValue({ data: [] })
    renderLeaderboard()

    await waitFor(() => {
      expect(screen.getByText(/no reports cleaned this month/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /browse the map/i })).toHaveAttribute('href', '/map')
  })

  it('fetches leaderboard with correct params', () => {
    mockApiGet.mockResolvedValue({ data: [] })
    renderLeaderboard()

    expect(mockApiGet).toHaveBeenCalledWith('/api/volunteers/leaderboard', {
      params: { months: 1, limit: 15 },
    })
  })

  it('renders volunteer entries in a table', async () => {
    mockApiGet.mockResolvedValue({ data: MOCK_ENTRIES })
    renderLeaderboard()

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    })
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    expect(screen.getByText('Charlie Taylor')).toBeInTheDocument()
    expect(screen.getByText('Dana Brown')).toBeInTheDocument()
  })

  it('shows medal emojis for top 3', async () => {
    mockApiGet.mockResolvedValue({ data: MOCK_ENTRIES })
    renderLeaderboard()

    await waitFor(() => {
      expect(screen.getByText('🥇')).toBeInTheDocument()
    })
    expect(screen.getByText('🥈')).toBeInTheDocument()
    expect(screen.getByText('🥉')).toBeInTheDocument()
  })

  it('shows numeric rank for entries beyond top 3', async () => {
    mockApiGet.mockResolvedValue({ data: MOCK_ENTRIES })
    renderLeaderboard()

    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument()
    })
  })

  it('displays cleaned counts', async () => {
    mockApiGet.mockResolvedValue({ data: MOCK_ENTRIES })
    renderLeaderboard()

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument()
      expect(screen.getByText('9')).toBeInTheDocument()
      expect(screen.getByText('7')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('shows share section when entries exist', async () => {
    mockApiGet.mockResolvedValue({ data: MOCK_ENTRIES })
    renderLeaderboard()

    await waitFor(() => {
      expect(screen.getByText('Share this leaderboard')).toBeInTheDocument()
    })
  })

  it('does not show share section when empty', async () => {
    mockApiGet.mockResolvedValue({ data: [] })
    renderLeaderboard()

    await waitFor(() => {
      expect(screen.getByText(/no reports cleaned/i)).toBeInTheDocument()
    })
    expect(screen.queryByText('Share this leaderboard')).not.toBeInTheDocument()
  })

  it('has a Facebook share link', async () => {
    mockApiGet.mockResolvedValue({ data: MOCK_ENTRIES })
    renderLeaderboard()

    const link = await screen.findByRole('link', { name: /facebook/i })
    expect(link).toHaveAttribute('href', expect.stringContaining('facebook.com/sharer'))
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('has an X/Twitter share link', async () => {
    mockApiGet.mockResolvedValue({ data: MOCK_ENTRIES })
    renderLeaderboard()

    const link = await screen.findByRole('link', { name: /post/i })
    expect(link).toHaveAttribute('href', expect.stringContaining('x.com/intent/tweet'))
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('has a copy link input with the page URL', async () => {
    mockApiGet.mockResolvedValue({ data: MOCK_ENTRIES })
    renderLeaderboard()

    const input = await screen.findByDisplayValue(window.location.href)
    expect(input).toHaveAttribute('readOnly')
  })

  it('shows Copied! after clicking the copy button', async () => {
    const user = userEvent.setup()
    mockApiGet.mockResolvedValue({ data: MOCK_ENTRIES })
    renderLeaderboard()

    const button = await screen.findByRole('button', { name: /copy link/i })
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })
  })

  it('has a back to home link', () => {
    mockApiGet.mockResolvedValue({ data: [] })
    renderLeaderboard()

    const link = screen.getByRole('link', { name: /back to home/i })
    expect(link).toHaveAttribute('href', '/')
  })

  it('renders table headers', async () => {
    mockApiGet.mockResolvedValue({ data: MOCK_ENTRIES })
    renderLeaderboard()

    await waitFor(() => {
      expect(screen.getByText('Rank')).toBeInTheDocument()
      expect(screen.getByText('Volunteer')).toBeInTheDocument()
      expect(screen.getByText('Cleaned')).toBeInTheDocument()
    })
  })
})
