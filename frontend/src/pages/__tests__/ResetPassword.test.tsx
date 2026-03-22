import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ResetPassword from '../ResetPassword'

const mockResetPassword = jest.fn()

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ resetPassword: mockResetPassword }),
}))

function renderResetPassword(token?: string) {
  const searchParams = token ? `?token=${token}` : ''
  return render(
    <MemoryRouter initialEntries={[`/reset-password${searchParams}`]}>
      <ResetPassword />
    </MemoryRouter>
  )
}

describe('ResetPassword', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the form', () => {
    renderResetPassword('abc123')
    expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument()
  })

  it('has password and confirm password inputs', () => {
    renderResetPassword('abc123')
    expect(screen.getByPlaceholderText('At least 6 characters')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Re-enter your new password')).toBeInTheDocument()
  })

  it('shows token input when no token in URL', () => {
    renderResetPassword()
    expect(screen.getByPlaceholderText('Paste your reset token')).toBeInTheDocument()
  })

  it('hides token input when token is in URL', () => {
    renderResetPassword('abc123')
    expect(screen.queryByPlaceholderText('Paste your reset token')).not.toBeInTheDocument()
  })

  it('has a submit button', () => {
    renderResetPassword('abc123')
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
  })

  it('has a back to login link', () => {
    renderResetPassword('abc123')
    const link = screen.getByRole('link', { name: /back to login/i })
    expect(link).toHaveAttribute('href', '/login')
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    renderResetPassword('abc123')

    await user.type(screen.getByPlaceholderText('At least 6 characters'), 'password1')
    await user.type(screen.getByPlaceholderText('Re-enter your new password'), 'password2')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
  })

  it('shows error when password is too short', async () => {
    const user = userEvent.setup()
    renderResetPassword('abc123')

    await user.type(screen.getByPlaceholderText('At least 6 characters'), '12345')
    await user.type(screen.getByPlaceholderText('Re-enter your new password'), '12345')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText('Password must be at least 6 characters.')).toBeInTheDocument()
  })

  it('calls resetPassword on valid submission', async () => {
    mockResetPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderResetPassword('abc123')

    await user.type(screen.getByPlaceholderText('At least 6 characters'), 'newpassword')
    await user.type(screen.getByPlaceholderText('Re-enter your new password'), 'newpassword')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(mockResetPassword).toHaveBeenCalledWith('abc123', 'newpassword')
  })

  it('shows success message after reset', async () => {
    mockResetPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderResetPassword('abc123')

    await user.type(screen.getByPlaceholderText('At least 6 characters'), 'newpassword')
    await user.type(screen.getByPlaceholderText('Re-enter your new password'), 'newpassword')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText('Password reset')).toBeInTheDocument()
    expect(screen.getByText(/password has been updated successfully/i)).toBeInTheDocument()
  })

  it('shows error on failed reset', async () => {
    mockResetPassword.mockRejectedValue(new Error('fail'))
    const user = userEvent.setup()
    renderResetPassword('abc123')

    await user.type(screen.getByPlaceholderText('At least 6 characters'), 'newpassword')
    await user.type(screen.getByPlaceholderText('Re-enter your new password'), 'newpassword')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText(/invalid or expired reset token/i)).toBeInTheDocument()
  })
})
