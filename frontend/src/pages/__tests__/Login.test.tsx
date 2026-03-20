import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from '../Login'

const mockLogin = jest.fn()
const mockNavigate = jest.fn()

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}))
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
}

describe('Login', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the login form', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument()
  })

  it('has email and password inputs', () => {
    renderLogin()
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument()
  })

  it('has a submit button', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
  })

  it('has a link to forgot password', () => {
    renderLogin()
    const link = screen.getByRole('link', { name: /forgot your password/i })
    expect(link).toHaveAttribute('href', '/forgot-password')
  })

  it('has a link to register', () => {
    renderLogin()
    const link = screen.getByRole('link', { name: /register/i })
    expect(link).toHaveAttribute('href', '/register')
  })

  it('calls login on form submission', async () => {
    mockLogin.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com')
    await user.type(screen.getByPlaceholderText('Enter your password'), 'password123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123')
  })

  it('navigates to admin on successful login', async () => {
    mockLogin.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com')
    await user.type(screen.getByPlaceholderText('Enter your password'), 'password123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/admin')
  })

  it('shows error on failed login', async () => {
    mockLogin.mockRejectedValue({ response: { data: { detail: 'Bad creds' } } })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com')
    await user.type(screen.getByPlaceholderText('Enter your password'), 'wrong')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
  })

  it('shows verify email message when unverified', async () => {
    mockLogin.mockRejectedValue({
      response: { data: { detail: 'Please verify your email first' } },
    })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com')
    await user.type(screen.getByPlaceholderText('Enter your password'), 'password123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(
      await screen.findByText(/verify your email before logging in/i),
    ).toBeInTheDocument()
  })
})
