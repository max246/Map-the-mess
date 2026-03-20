import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import VerifyEmail from '../VerifyEmail'
import api from '../../api/client'

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}))

const mockApi = api as jest.Mocked<typeof api>

function renderVerifyEmail(token?: string) {
  const searchParams = token ? `?token=${token}` : ''
  return render(
    <MemoryRouter initialEntries={[`/verify-email${searchParams}`]}>
      <VerifyEmail />
    </MemoryRouter>
  )
}

describe('VerifyEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows loading state initially with a token', () => {
    mockApi.get.mockReturnValue(new Promise(() => {})) // never resolves
    renderVerifyEmail('abc123')
    expect(screen.getByText(/verifying your email/i)).toBeInTheDocument()
  })

  it('shows error when no token is provided', () => {
    renderVerifyEmail()
    expect(screen.getByText('Verification failed')).toBeInTheDocument()
    expect(screen.getByText('No verification token provided.')).toBeInTheDocument()
  })

  it('shows success on valid token', async () => {
    mockApi.get.mockResolvedValue({ data: {} })
    renderVerifyEmail('valid-token')

    expect(await screen.findByText('Email verified')).toBeInTheDocument()
    expect(screen.getByText(/your account is now active/i)).toBeInTheDocument()
  })

  it('has a login link on success', async () => {
    mockApi.get.mockResolvedValue({ data: {} })
    renderVerifyEmail('valid-token')

    const link = await screen.findByRole('link', { name: /log in/i })
    expect(link).toHaveAttribute('href', '/login')
  })

  it('shows error on invalid token', async () => {
    mockApi.get.mockRejectedValue({
      response: { data: { detail: 'Token expired' } },
    })
    renderVerifyEmail('bad-token')

    expect(await screen.findByText('Verification failed')).toBeInTheDocument()
    expect(screen.getByText('Token expired')).toBeInTheDocument()
  })

  it('shows resend form on error', async () => {
    mockApi.get.mockRejectedValue({
      response: { data: { detail: 'Invalid token' } },
    })
    renderVerifyEmail('bad-token')

    expect(await screen.findByText(/enter your email to resend/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument()
  })

  it('resends verification email', async () => {
    mockApi.get.mockRejectedValue({
      response: { data: { detail: 'Invalid token' } },
    })
    mockApi.post.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    renderVerifyEmail('bad-token')

    await screen.findByText('Verification failed')

    await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /resend verification email/i }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/api/auth/resend-verification', {
        email: 'test@example.com',
      })
    })
    expect(await screen.findByText(/verification email sent/i)).toBeInTheDocument()
  })
})
