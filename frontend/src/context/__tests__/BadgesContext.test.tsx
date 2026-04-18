import { render, screen, waitFor, act } from '@testing-library/react'
import { BadgesProvider, useBadges } from '../BadgesContext'

/* ── mocked auth context ──────────────────────────── */
let mockAuth = { isLoggedIn: true }
jest.mock('../AuthContext', () => ({
  useAuth: () => mockAuth,
}))

/* ── mocked API endpoints ─────────────────────────── */
const mockGetProfile = jest.fn()
const mockAcknowledge = jest.fn()

jest.mock('../../api/endpoints/auth/auth', () => ({
  getAuth: () => ({
    getProfileApiAuthMeGet: (...args: unknown[]) => mockGetProfile(...args),
  }),
}))

jest.mock('../../api/endpoints/badges/badges', () => ({
  getBadges: () => ({
    acknowledgeBadgeApiBadgesBadgeIdAcknowledgePost: (...args: unknown[]) =>
      mockAcknowledge(...args),
  }),
}))

/* ── test harness — exposes hook state to assertions ─ */
function Harness() {
  const ctx = useBadges()
  return (
    <div>
      <span data-testid="count">{ctx.badges.length}</span>
      <span data-testid="unack-count">{ctx.unacknowledged.length}</span>
      <span data-testid="unack-ids">{ctx.unacknowledged.map((b) => b.id).join(',')}</span>
      <button onClick={() => ctx.acknowledge('reporter_1')}>ack-one</button>
      <button onClick={() => ctx.refresh()}>refresh</button>
    </div>
  )
}

function renderHarness() {
  return render(
    <BadgesProvider>
      <Harness />
    </BadgesProvider>
  )
}

describe('BadgesContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth = { isLoggedIn: true }
  })

  it('fetches profile on mount when logged in', async () => {
    mockGetProfile.mockResolvedValue({ badges: [] })
    renderHarness()
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalledTimes(1))
  })

  it('skips fetch and exposes empty list when logged out', async () => {
    mockAuth = { isLoggedIn: false }
    mockGetProfile.mockResolvedValue({ badges: [{ id: 'reporter_1' }] })
    renderHarness()
    // Wait a tick to be sure nothing kicks off
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'))
    expect(mockGetProfile).not.toHaveBeenCalled()
  })

  it('surfaces badges and splits by acknowledgement state', async () => {
    mockGetProfile.mockResolvedValue({
      badges: [
        {
          id: 'reporter_1',
          name: 'First Spotter',
          description: '',
          awarded_at: '2026-04-01T00:00:00Z',
          acknowledged_at: null,
        },
        {
          id: 'reporter_10',
          name: 'Sharp Eye',
          description: '',
          awarded_at: '2026-04-02T00:00:00Z',
          acknowledged_at: '2026-04-03T00:00:00Z',
        },
      ],
    })

    renderHarness()

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))
    expect(screen.getByTestId('unack-count').textContent).toBe('1')
    expect(screen.getByTestId('unack-ids').textContent).toBe('reporter_1')
  })

  it('treats badges missing awarded_at as already acknowledged (legacy shape)', async () => {
    mockGetProfile.mockResolvedValue({
      badges: [
        { id: 'reporter_1', name: 'x', description: '' }, // no timestamps
      ],
    })

    renderHarness()

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    expect(screen.getByTestId('unack-count').textContent).toBe('0')
  })

  it('acknowledge() flips a badge from unacknowledged to acknowledged in place', async () => {
    mockGetProfile.mockResolvedValue({
      badges: [
        {
          id: 'reporter_1',
          name: 'First Spotter',
          description: '',
          awarded_at: '2026-04-01T00:00:00Z',
          acknowledged_at: null,
        },
      ],
    })
    mockAcknowledge.mockResolvedValue({
      id: 'reporter_1',
      name: 'First Spotter',
      description: '',
      awarded_at: '2026-04-01T00:00:00Z',
      acknowledged_at: '2026-04-05T00:00:00Z',
    })

    renderHarness()
    await waitFor(() => expect(screen.getByTestId('unack-count').textContent).toBe('1'))

    await act(async () => {
      screen.getByText('ack-one').click()
    })

    await waitFor(() => expect(screen.getByTestId('unack-count').textContent).toBe('0'))
    expect(mockAcknowledge).toHaveBeenCalledWith('reporter_1')
    // Total count stays the same — the row was updated, not removed
    expect(screen.getByTestId('count').textContent).toBe('1')
  })

  it('swallows profile fetch errors without crashing', async () => {
    mockGetProfile.mockRejectedValue(new Error('network'))
    renderHarness()
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled())
    expect(screen.getByTestId('count').textContent).toBe('0')
  })

  it('swallows acknowledge errors without mutating state', async () => {
    mockGetProfile.mockResolvedValue({
      badges: [
        {
          id: 'reporter_1',
          name: 'First Spotter',
          description: '',
          awarded_at: '2026-04-01T00:00:00Z',
          acknowledged_at: null,
        },
      ],
    })
    mockAcknowledge.mockRejectedValue(new Error('500'))

    renderHarness()
    await waitFor(() => expect(screen.getByTestId('unack-count').textContent).toBe('1'))

    await act(async () => {
      screen.getByText('ack-one').click()
    })

    // Still unacknowledged because the server said no
    expect(screen.getByTestId('unack-count').textContent).toBe('1')
  })

  it('throws if useBadges is used outside the provider', () => {
    // Silence the React error boundary noise for this expected throw
    const err = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Harness />)).toThrow(/BadgesProvider/)
    err.mockRestore()
  })
})
