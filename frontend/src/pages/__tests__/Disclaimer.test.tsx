import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Disclaimer from '../Disclaimer'

function renderDisclaimer() {
  return render(
    <MemoryRouter>
      <Disclaimer />
    </MemoryRouter>,
  )
}

describe('Disclaimer', () => {
  it('renders the page title', () => {
    renderDisclaimer()
    expect(screen.getByText('Disclaimer & Conditions of Use')).toBeInTheDocument()
  })

  it('displays the at your own risk banner', () => {
    renderDisclaimer()
    const banner = screen.getByText(/entirely at your own risk.*Map the Mess/i)
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveClass('text-amber-900')
  })

  it('explains the platform is for small-scale litter', () => {
    renderDisclaimer()
    expect(screen.getByText(/small-scale litter/i)).toBeInTheDocument()
  })

  it('warns about fly-tipping and local council', () => {
    renderDisclaimer()
    expect(screen.getByText('Fly-Tipping & Large Dumping')).toBeInTheDocument()
    expect(screen.getByText(/report it directly to your/i)).toBeInTheDocument()
  })

  it('covers personal safety and no liability for injury', () => {
    renderDisclaimer()
    expect(screen.getByText('Personal Safety')).toBeInTheDocument()
    expect(screen.getByText(/Volunteering to pick up litter is done entirely at your own risk/)).toBeInTheDocument()
  })

  it('covers private land and permission', () => {
    renderDisclaimer()
    expect(screen.getByText('Private Land & Permission')).toBeInTheDocument()
    expect(screen.getByText(/permission from the landowner/i)).toBeInTheDocument()
  })

  it('covers limitation of liability', () => {
    renderDisclaimer()
    expect(screen.getByText('Limitation of Liability')).toBeInTheDocument()
  })

  it('has a link back to report page', () => {
    renderDisclaimer()
    const link = screen.getByRole('link', { name: /back to report litter/i })
    expect(link).toHaveAttribute('href', '/report')
  })
})
