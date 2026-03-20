import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import UserManagement from '../UserManagement'

/* ── mock data ─────────────────────────────────────────── */
const USERS = [
  {
    id: 1,
    full_name: 'Alice Admin',
    email: 'alice@example.com',
    user_type: 'admin',
    created_at: '2025-06-01T00:00:00Z',
  },
  {
    id: 2,
    full_name: 'Bob Volunteer',
    email: 'bob@example.com',
    user_type: 'volunteer',
    created_at: '2025-09-15T00:00:00Z',
  },
  {
    id: 3,
    full_name: 'Charlie Mod',
    email: 'charlie@example.com',
    user_type: 'moderator',
    created_at: '2026-01-20T00:00:00Z',
  },
]

/* ── mocks ────────────────────────────────────────────── */
const mockGet = jest.fn()
const mockPatch = jest.fn()
const mockDeleteApi = jest.fn()

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDeleteApi(...args),
  },
}))

let mockAuth = { isLoggedIn: true, canManageUsers: true, token: 'test-token' }
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

function renderUserManagement() {
  return render(
    <MemoryRouter>
      <UserManagement />
    </MemoryRouter>
  )
}

describe('UserManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth = { isLoggedIn: true, canManageUsers: true, token: 'test-token' }
    mockGet.mockResolvedValue({ data: USERS })
  })

  /* ── Access control ──────────────────────────────── */

  it('redirects to login when not logged in', () => {
    mockAuth = { isLoggedIn: false, canManageUsers: false, token: '' }
    renderUserManagement()
    // Navigate component renders nothing visible; page content should not appear
    expect(screen.queryByText('User Management')).not.toBeInTheDocument()
  })

  it('redirects when user cannot manage users', () => {
    mockAuth = { isLoggedIn: true, canManageUsers: false, token: 'test-token' }
    renderUserManagement()
    expect(screen.queryByText('User Management')).not.toBeInTheDocument()
  })

  /* ── Loading & rendering ─────────────────────────── */

  it('shows loading state', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    renderUserManagement()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders the page title', async () => {
    renderUserManagement()
    expect(await screen.findByText('User Management')).toBeInTheDocument()
  })

  it('shows table headers', async () => {
    renderUserManagement()
    await screen.findByText('Alice Admin')
    expect(screen.getByText('ID')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Role')).toBeInTheDocument()
    expect(screen.getByText('Joined')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })

  it('shows empty state when no users', async () => {
    mockGet.mockResolvedValue({ data: [] })
    renderUserManagement()
    expect(await screen.findByText('No users found.')).toBeInTheDocument()
  })

  /* ── User list ───────────────────────────────────── */

  it('displays all users', async () => {
    renderUserManagement()
    expect(await screen.findByText('Alice Admin')).toBeInTheDocument()
    expect(screen.getByText('Bob Volunteer')).toBeInTheDocument()
    expect(screen.getByText('Charlie Mod')).toBeInTheDocument()
  })

  it('displays user emails', async () => {
    renderUserManagement()
    expect(await screen.findByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    expect(screen.getByText('charlie@example.com')).toBeInTheDocument()
  })

  it('displays user IDs', async () => {
    renderUserManagement()
    expect(await screen.findByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('#3')).toBeInTheDocument()
  })

  it('displays joined dates', async () => {
    renderUserManagement()
    await screen.findByText('Alice Admin')
    // en-GB short format
    expect(screen.getByText(/1 Jun 2025/)).toBeInTheDocument()
    expect(screen.getByText(/15 Sept 2025/)).toBeInTheDocument()
  })

  /* ── Role dropdowns ──────────────────────────────── */

  it('shows role dropdown for each user', async () => {
    renderUserManagement()
    await screen.findByText('Alice Admin')
    const selects = screen.getAllByRole('combobox')
    expect(selects).toHaveLength(3)
  })

  it('displays correct current role in dropdown', async () => {
    renderUserManagement()
    await screen.findByText('Alice Admin')
    const selects = screen.getAllByRole('combobox')
    expect(selects[0]).toHaveValue('admin')
    expect(selects[1]).toHaveValue('volunteer')
    expect(selects[2]).toHaveValue('moderator')
  })

  it('has all role options in dropdown', async () => {
    renderUserManagement()
    await screen.findByText('Alice Admin')
    const firstSelect = screen.getAllByRole('combobox')[0]
    const options = within(firstSelect).getAllByRole('option')
    expect(options).toHaveLength(4)
    expect(options.map((o) => o.textContent)).toEqual([
      'Superuser',
      'Admin',
      'Moderator',
      'Volunteer',
    ])
  })

  it('calls API when changing role', async () => {
    mockPatch.mockResolvedValue({ data: { ...USERS[1], user_type: 'moderator' } })
    const user = userEvent.setup()
    renderUserManagement()
    await screen.findByText('Bob Volunteer')

    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[1], 'moderator')

    expect(mockPatch).toHaveBeenCalledWith(
      '/api/auth/users/2/type',
      { user_type: 'moderator' },
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })

  it('shows error when role change fails', async () => {
    mockPatch.mockRejectedValue({ response: { data: { detail: 'Cannot change superuser role' } } })
    const user = userEvent.setup()
    renderUserManagement()
    await screen.findByText('Alice Admin')

    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[0], 'volunteer')

    expect(await screen.findByText('Cannot change superuser role')).toBeInTheDocument()
  })

  /* ── Delete ──────────────────────────────────────── */

  it('shows delete button for each user', async () => {
    renderUserManagement()
    await screen.findByText('Alice Admin')
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    expect(deleteButtons).toHaveLength(3)
  })

  it('calls API when deleting a user after confirmation', async () => {
    mockDeleteApi.mockResolvedValue({})
    window.confirm = jest.fn().mockReturnValue(true)
    const user = userEvent.setup()
    renderUserManagement()
    await screen.findByText('Bob Volunteer')

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[1])

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete user bob@example.com?'
    )
    expect(mockDeleteApi).toHaveBeenCalledWith(
      '/api/auth/users/2',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })

  it('removes user from list after deletion', async () => {
    mockDeleteApi.mockResolvedValue({})
    window.confirm = jest.fn().mockReturnValue(true)
    const user = userEvent.setup()
    renderUserManagement()
    await screen.findByText('Bob Volunteer')

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[1])

    await waitFor(() => {
      expect(screen.queryByText('Bob Volunteer')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Alice Admin')).toBeInTheDocument()
    expect(screen.getByText('Charlie Mod')).toBeInTheDocument()
  })

  it('does not delete when confirmation is cancelled', async () => {
    window.confirm = jest.fn().mockReturnValue(false)
    const user = userEvent.setup()
    renderUserManagement()
    await screen.findByText('Bob Volunteer')

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[1])

    expect(mockDeleteApi).not.toHaveBeenCalled()
    expect(screen.getByText('Bob Volunteer')).toBeInTheDocument()
  })

  it('shows error when delete fails', async () => {
    mockDeleteApi.mockRejectedValue({ response: { data: { detail: 'Cannot delete superuser' } } })
    window.confirm = jest.fn().mockReturnValue(true)
    const user = userEvent.setup()
    renderUserManagement()
    await screen.findByText('Alice Admin')

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[0])

    expect(await screen.findByText('Cannot delete superuser')).toBeInTheDocument()
  })

  /* ── Error state ─────────────────────────────────── */

  it('shows error when loading users fails', async () => {
    mockGet.mockRejectedValue(new Error('Network error'))
    renderUserManagement()
    expect(await screen.findByText('Failed to load users.')).toBeInTheDocument()
  })
})
