import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReportComments from '../ReportComments'

/* ── mock data ────────────────────────────────────── */
const makeComment = (
  id: string,
  body: string,
  userId = 'user-1',
  date = '2026-04-10T12:00:00Z'
) => ({
  id,
  report_id: 'report-1',
  user_id: userId,
  body,
  created_at: date,
})

// 5 comments so we get 2 pages (PAGE_SIZE = 4)
const fiveComments = [
  makeComment('c1', 'Oldest comment', 'user-1', '2026-04-01T10:00:00Z'),
  makeComment('c2', 'Second comment', 'user-2', '2026-04-02T10:00:00Z'),
  makeComment('c3', 'Third comment', 'user-2', '2026-04-03T10:00:00Z'),
  makeComment('c4', 'Fourth comment', 'user-1', '2026-04-04T10:00:00Z'),
  makeComment('c5', 'Newest comment', 'user-1', '2026-04-05T10:00:00Z'),
]

/* ── mock API ─────────────────────────────────────── */
const mockListComments = jest.fn().mockResolvedValue([])
const mockAddComment = jest.fn().mockResolvedValue(makeComment('c-new', 'New comment'))
const mockDeleteComment = jest.fn().mockResolvedValue(undefined)

jest.mock('../../api/endpoints/reports/reports', () => ({
  getReports: () => ({
    listCommentsApiReportsReportIdCommentsGet: (...args: unknown[]) => mockListComments(...args),
    addCommentApiReportsReportIdCommentsPost: (...args: unknown[]) => mockAddComment(...args),
    deleteCommentApiReportsReportIdCommentsCommentIdDelete: (...args: unknown[]) =>
      mockDeleteComment(...args),
  }),
}))

/* ── mock useAuth ─────────────────────────────────── */
let mockAuth = {
  user: null as { id: string; email: string; userType: string; exp: number } | null,
  isLoggedIn: false,
  canManageUsers: false,
}

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

/* ── helpers ──────────────────────────────────────── */
const defaultProps = {
  reportId: 'report-1',
  reportStatus: 'pending',
  reportOwnerId: 'owner-1',
}

function renderComments(props = {}) {
  return render(<ReportComments {...defaultProps} {...props} />)
}

/* ── tests ────────────────────────────────────────── */
describe('ReportComments', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListComments.mockResolvedValue([])
    mockAuth = { user: null, isLoggedIn: false, canManageUsers: false }
    window.confirm = jest.fn(() => true)
  })

  /* ── Loading & empty state ─────────────────────── */

  it('shows loading state then empty message when no comments', async () => {
    renderComments()

    expect(screen.getByText('Loading comments...')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('No comments yet.')).toBeInTheDocument()
    })
  })

  it('fetches comments on mount with the report ID', async () => {
    renderComments()

    await waitFor(() => {
      expect(mockListComments).toHaveBeenCalledWith('report-1')
    })
  })

  /* ── Displaying comments ───────────────────────── */

  it('displays comments in reverse order (newest first)', async () => {
    mockListComments.mockResolvedValue([
      makeComment('c1', 'Oldest', 'user-1', '2026-04-01T10:00:00Z'),
      makeComment('c2', 'Newest', 'user-1', '2026-04-02T10:00:00Z'),
    ])

    renderComments()

    await waitFor(() => {
      expect(screen.getByText('Newest')).toBeInTheDocument()
    })

    const bodies = screen.getAllByText(/Oldest|Newest/)
    expect(bodies[0]).toHaveTextContent('Newest')
    expect(bodies[1]).toHaveTextContent('Oldest')
  })

  it('shows comment count in heading', async () => {
    mockListComments.mockResolvedValue([makeComment('c1', 'Hello')])
    renderComments()

    await waitFor(() => {
      expect(screen.getByText('Comments (1)')).toBeInTheDocument()
    })
  })

  /* ── Pagination ────────────────────────────────── */

  it('paginates at 4 comments per page', async () => {
    mockListComments.mockResolvedValue(fiveComments)
    renderComments()

    await waitFor(() => {
      // Newest first, so page 1 shows c5, c4, c3, c2
      expect(screen.getByText('Newest comment')).toBeInTheDocument()
    })

    // 4 comments on page 1
    expect(screen.getByText('Newest comment')).toBeInTheDocument()
    expect(screen.getByText('Fourth comment')).toBeInTheDocument()
    expect(screen.getByText('Third comment')).toBeInTheDocument()
    expect(screen.getByText('Second comment')).toBeInTheDocument()
    // Oldest is on page 2
    expect(screen.queryByText('Oldest comment')).not.toBeInTheDocument()

    // Pagination controls visible
    expect(screen.getByText('Previous')).toBeInTheDocument()
    expect(screen.getByText('Next')).toBeInTheDocument()
  })

  it('navigates to page 2 to see older comments', async () => {
    mockListComments.mockResolvedValue(fiveComments)
    const user = userEvent.setup()
    renderComments()

    await waitFor(() => {
      expect(screen.getByText('Newest comment')).toBeInTheDocument()
    })

    await user.click(screen.getByText('2'))

    expect(screen.getByText('Oldest comment')).toBeInTheDocument()
    expect(screen.queryByText('Newest comment')).not.toBeInTheDocument()
  })

  it('does not show pagination controls with 4 or fewer comments', async () => {
    mockListComments.mockResolvedValue([makeComment('c1', 'Only one')])
    renderComments()

    await waitFor(() => {
      expect(screen.getByText('Only one')).toBeInTheDocument()
    })

    expect(screen.queryByText('Previous')).not.toBeInTheDocument()
    expect(screen.queryByText('Next')).not.toBeInTheDocument()
  })

  /* ── Add comment form visibility ───────────────── */

  it('shows comment form for logged-in users on open reports', async () => {
    mockAuth = {
      user: { id: 'user-1', email: 'a@b.com', userType: 'user', exp: 9999999999 },
      isLoggedIn: true,
      canManageUsers: false,
    }

    renderComments({ reportStatus: 'pending' })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Write a comment...')).toBeInTheDocument()
    })
    expect(screen.getByText('Post Comment')).toBeInTheDocument()
  })

  it('hides comment form for logged-out users and shows login prompt', async () => {
    mockAuth = { user: null, isLoggedIn: false, canManageUsers: false }
    renderComments({ reportStatus: 'pending' })

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Write a comment...')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Log in to leave a comment.')).toBeInTheDocument()
  })

  it('hides comment form on cleaned (resolved) reports', async () => {
    mockAuth = {
      user: { id: 'user-1', email: 'a@b.com', userType: 'user', exp: 9999999999 },
      isLoggedIn: true,
      canManageUsers: false,
    }

    renderComments({ reportStatus: 'cleaned' })

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Write a comment...')).not.toBeInTheDocument()
    })
    // No login prompt either since user is logged in
    expect(screen.queryByText('Log in to leave a comment.')).not.toBeInTheDocument()
  })

  /* ── Submitting a comment ──────────────────────── */

  it('submits a comment and resets the form', async () => {
    mockAuth = {
      user: { id: 'user-1', email: 'a@b.com', userType: 'user', exp: 9999999999 },
      isLoggedIn: true,
      canManageUsers: false,
    }
    const user = userEvent.setup()
    renderComments()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Write a comment...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Write a comment...')
    await user.type(textarea, 'My new comment')
    await user.click(screen.getByText('Post Comment'))

    await waitFor(() => {
      expect(mockAddComment).toHaveBeenCalledWith('report-1', { body: 'My new comment' })
    })
  })

  it('does not submit an empty comment', async () => {
    mockAuth = {
      user: { id: 'user-1', email: 'a@b.com', userType: 'user', exp: 9999999999 },
      isLoggedIn: true,
      canManageUsers: false,
    }
    renderComments()

    await waitFor(() => {
      expect(screen.getByText('Post Comment')).toBeInTheDocument()
    })

    expect(screen.getByText('Post Comment')).toBeDisabled()
  })

  /* ── Delete comment ────────────────────────────── */

  it('shows delete button for comment owner', async () => {
    mockAuth = {
      user: { id: 'user-1', email: 'a@b.com', userType: 'user', exp: 9999999999 },
      isLoggedIn: true,
      canManageUsers: false,
    }
    mockListComments.mockResolvedValue([makeComment('c1', 'My comment', 'user-1')])
    renderComments()

    await waitFor(() => {
      expect(screen.getByTitle('Delete comment')).toBeInTheDocument()
    })
  })

  it('hides delete button for non-owner regular users', async () => {
    mockAuth = {
      user: { id: 'user-99', email: 'other@b.com', userType: 'user', exp: 9999999999 },
      isLoggedIn: true,
      canManageUsers: false,
    }
    mockListComments.mockResolvedValue([makeComment('c1', 'Not my comment', 'user-1')])
    renderComments()

    await waitFor(() => {
      expect(screen.getByText('Not my comment')).toBeInTheDocument()
    })
    expect(screen.queryByTitle('Delete comment')).not.toBeInTheDocument()
  })

  it('shows delete button for admin/moderator on any comment', async () => {
    mockAuth = {
      user: { id: 'admin-1', email: 'admin@b.com', userType: 'admin', exp: 9999999999 },
      isLoggedIn: true,
      canManageUsers: true,
    }
    mockListComments.mockResolvedValue([makeComment('c1', 'Someone else comment', 'user-1')])
    renderComments()

    await waitFor(() => {
      expect(screen.getByTitle('Delete comment')).toBeInTheDocument()
    })
  })

  it('calls delete API when delete is confirmed', async () => {
    mockAuth = {
      user: { id: 'user-1', email: 'a@b.com', userType: 'user', exp: 9999999999 },
      isLoggedIn: true,
      canManageUsers: false,
    }
    mockListComments.mockResolvedValue([makeComment('c1', 'Delete me', 'user-1')])
    const user = userEvent.setup()
    renderComments()

    await waitFor(() => {
      expect(screen.getByTitle('Delete comment')).toBeInTheDocument()
    })

    await user.click(screen.getByTitle('Delete comment'))

    await waitFor(() => {
      expect(mockDeleteComment).toHaveBeenCalledWith('report-1', 'c1')
    })
  })

  it('does not call delete API when confirm is cancelled', async () => {
    ;(window.confirm as jest.Mock).mockReturnValue(false)
    mockAuth = {
      user: { id: 'user-1', email: 'a@b.com', userType: 'user', exp: 9999999999 },
      isLoggedIn: true,
      canManageUsers: false,
    }
    mockListComments.mockResolvedValue([makeComment('c1', 'Keep me', 'user-1')])
    const user = userEvent.setup()
    renderComments()

    await waitFor(() => {
      expect(screen.getByTitle('Delete comment')).toBeInTheDocument()
    })

    await user.click(screen.getByTitle('Delete comment'))
    expect(mockDeleteComment).not.toHaveBeenCalled()
  })
})
