import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ForgotPassword from '../ForgotPassword'

const mockForgotPassword = jest.fn()

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ forgotPassword: mockForgotPassword }),
}))

function renderForgotPassword() {
  return render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>,
  )
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the form', () => {
    renderForgotPassword()
    expect(screen.getByText('Forgot password')).toBeInTheDocument()
  })

  it('shows instructions', () => {
    renderForgotPassword()
    expect(screen.getByText(/send you a link to reset your password/i)).toBeInTheDocument()
  })

  it('has an email input', () => {
    renderForgotPassword()
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
  })

  it('has a submit button', () => {
    renderForgotPassword()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })

  it('has a back to login link', () => {
    renderForgotPassword()
    const link = screen.getByRole('link', { name: /back to login/i })
    expect(link).toHaveAttribute('href', '/login')
  })

  it('calls forgotPassword on submit', async () => {
    mockForgotPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderForgotPassword()

    await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(mockForgotPassword).toHaveBeenCalledWith('test@example.com')
  })

  it('shows confirmation message after successful submit', async () => {
    mockForgotPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderForgotPassword()

    await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('Check your email')).toBeInTheDocument()
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument()
  })

  it('shows error on failure', async () => {
    mockForgotPassword.mockRejectedValue(new Error('fail'))
    const user = userEvent.setup()
    renderForgotPassword()

    await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
  })
})
