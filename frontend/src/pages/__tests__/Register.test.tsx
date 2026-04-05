import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Register from '../Register'

const mockRegister = jest.fn()

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    register: (...args: unknown[]) => mockRegister(...args),
  }),
}))

const NOMINATIM_RESULTS = [
  { display_name: 'London, England, United Kingdom', lat: '51.5074', lon: '-0.1278' },
]

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  )
}

describe('Register', () => {
  it('renders the registration form', () => {
    renderRegister()
    expect(screen.getByText('Create an account')).toBeInTheDocument()
  })

  it('shows the terms acceptance checkbox', () => {
    renderRegister()
    expect(screen.getByText(/I agree to the/i)).toBeInTheDocument()
  })

  it('links to the disclaimer page', () => {
    renderRegister()
    const link = screen.getByRole('link', { name: /disclaimer and conditions of use/i })
    expect(link).toHaveAttribute('href', '/disclaimer')
  })

  it('links to the privacy policy', () => {
    renderRegister()
    const link = screen.getByRole('link', { name: /privacy policy/i })
    expect(link).toHaveAttribute('href', '/privacy')
  })

  it('register button is disabled when terms are not accepted', () => {
    renderRegister()
    const button = screen.getByRole('button', { name: /register/i })
    expect(button).toBeDisabled()
  })

  it('register button is still disabled after accepting terms without city', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderRegister()

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    const button = screen.getByRole('button', { name: /register/i })
    expect(button).toBeDisabled()
  })

  /* ── City field ──────────────────────────────────── */

  it('shows the city field', () => {
    renderRegister()
    expect(screen.getByText('Your city')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Start typing your city...')).toBeInTheDocument()
  })

  it('register button is disabled when no city is selected', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderRegister()

    await user.click(screen.getByRole('checkbox'))

    expect(screen.getByRole('button', { name: /register/i })).toBeDisabled()
  })

  it('register button is enabled after accepting terms and selecting city', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(NOMINATIM_RESULTS),
    })
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderRegister()

    await user.type(screen.getByPlaceholderText('Start typing your city...'), 'Lon')
    act(() => {
      jest.advanceTimersByTime(300)
    })
    await user.click(await screen.findByText('London, England, United Kingdom'))

    await user.click(screen.getByRole('checkbox'))

    expect(screen.getByRole('button', { name: /register/i })).toBeEnabled()
  })

  it('selects a city and displays it', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(NOMINATIM_RESULTS),
    })
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderRegister()

    await user.type(screen.getByPlaceholderText('Start typing your city...'), 'Lon')
    act(() => {
      jest.advanceTimersByTime(300)
    })

    await user.click(await screen.findByText('London, England, United Kingdom'))

    expect(screen.getByText('London, England, United Kingdom')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Start typing your city...')).not.toBeInTheDocument()
  })

  it('allows changing selected city', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(NOMINATIM_RESULTS),
    })
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderRegister()

    await user.type(screen.getByPlaceholderText('Start typing your city...'), 'Lon')
    act(() => {
      jest.advanceTimersByTime(300)
    })
    await user.click(await screen.findByText('London, England, United Kingdom'))

    await user.click(screen.getByRole('button', { name: /change/i }))

    expect(screen.getByPlaceholderText('Start typing your city...')).toBeInTheDocument()
  })

  it('submits registration with city coordinates', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(NOMINATIM_RESULTS),
    })
    mockRegister.mockResolvedValue({})
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderRegister()

    await user.type(screen.getByPlaceholderText('Enter your full name'), 'Jane Doe')
    await user.type(screen.getByPlaceholderText('Enter your email'), 'jane@example.com')
    await user.type(screen.getByPlaceholderText('At least 6 characters'), 'password123')
    await user.type(screen.getByPlaceholderText('Re-enter your password'), 'password123')

    // Select city
    await user.type(screen.getByPlaceholderText('Start typing your city...'), 'Lon')
    act(() => {
      jest.advanceTimersByTime(300)
    })
    await user.click(await screen.findByText('London, England, United Kingdom'))

    // Accept terms and submit
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /register/i }))

    expect(mockRegister).toHaveBeenCalledWith(
      'jane@example.com',
      'Jane Doe',
      'password123',
      51.5074,
      -0.1278
    )
  })

  it('cannot submit registration without selecting a city', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderRegister()

    await user.type(screen.getByPlaceholderText('Enter your full name'), 'Jane Doe')
    await user.type(screen.getByPlaceholderText('Enter your email'), 'jane@example.com')
    await user.type(screen.getByPlaceholderText('At least 6 characters'), 'password123')
    await user.type(screen.getByPlaceholderText('Re-enter your password'), 'password123')

    await user.click(screen.getByRole('checkbox'))

    expect(screen.getByRole('button', { name: /register/i })).toBeDisabled()
    expect(mockRegister).not.toHaveBeenCalled()
  })
})
