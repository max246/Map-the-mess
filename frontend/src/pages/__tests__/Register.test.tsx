import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Register from '../Register'

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    register: jest.fn(),
  }),
}))

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
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

  it('register button is enabled after accepting terms', async () => {
    const user = userEvent.setup()
    renderRegister()

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    const button = screen.getByRole('button', { name: /register/i })
    expect(button).toBeEnabled()
  })
})
