import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PrivacyPolicy from '../PrivacyPolicy'

function renderPrivacyPolicy() {
  return render(
    <MemoryRouter>
      <PrivacyPolicy />
    </MemoryRouter>,
  )
}

describe('PrivacyPolicy', () => {
  it('renders the page title', () => {
    renderPrivacyPolicy()
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
  })

  it('displays the last updated date', () => {
    renderPrivacyPolicy()
    expect(screen.getByText(/last updated/i)).toBeInTheDocument()
  })

  it('covers account information collection', () => {
    renderPrivacyPolicy()
    expect(screen.getByText('Account Information')).toBeInTheDocument()
    expect(screen.getByText(/full name, email address, and a password/i)).toBeInTheDocument()
  })

  it('covers location data collection', () => {
    renderPrivacyPolicy()
    expect(screen.getByText('Location Data')).toBeInTheDocument()
    expect(screen.getByText(/do not continuously track your location/i)).toBeInTheDocument()
  })

  it('covers photo uploads and EXIF data', () => {
    renderPrivacyPolicy()
    expect(screen.getByText('Photos')).toBeInTheDocument()
    expect(screen.getByText(/EXIF data/i)).toBeInTheDocument()
  })

  it('lists third-party services', () => {
    renderPrivacyPolicy()
    expect(screen.getByText('Third-Party Services')).toBeInTheDocument()
    expect(screen.getAllByText(/What3Words/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/OpenStreetMap/).length).toBeGreaterThan(0)
  })

  it('states data is not sold', () => {
    renderPrivacyPolicy()
    expect(screen.getByText(/do not sell your data/i)).toBeInTheDocument()
  })

  it('covers cookies and local storage', () => {
    renderPrivacyPolicy()
    expect(screen.getByText('Cookies & Local Storage')).toBeInTheDocument()
    expect(screen.getByText(/not used for tracking or advertising/i)).toBeInTheDocument()
  })

  it('covers UK GDPR rights', () => {
    renderPrivacyPolicy()
    expect(screen.getByText('Your Rights')).toBeInTheDocument()
    expect(screen.getByText(/UK GDPR/i)).toBeInTheDocument()
  })

  it('has a use at your own risk section', () => {
    renderPrivacyPolicy()
    expect(screen.getByText('Use at Your Own Risk')).toBeInTheDocument()
    expect(screen.getByText(/as is/i)).toBeInTheDocument()
  })

  it('covers minimum age requirement', () => {
    renderPrivacyPolicy()
    expect(screen.getByText('Children')).toBeInTheDocument()
    expect(screen.getByText(/under the age of 16/i)).toBeInTheDocument()
  })

  it('links to the contact page', () => {
    renderPrivacyPolicy()
    const link = screen.getByRole('link', { name: /contact page/i })
    expect(link).toHaveAttribute('href', '/contact')
  })

  it('links to the disclaimer page', () => {
    renderPrivacyPolicy()
    const link = screen.getByRole('link', { name: /disclaimer and conditions of use/i })
    expect(link).toHaveAttribute('href', '/disclaimer')
  })
})
