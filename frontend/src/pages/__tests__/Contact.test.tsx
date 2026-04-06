import { render, screen } from '@testing-library/react'
import Contact from '../Contact'

describe('Contact', () => {
  beforeEach(() => {
    render(<Contact />)
  })

  it('renders the page title', () => {
    expect(screen.getByRole('heading', { name: /contact us/i })).toBeInTheDocument()
  })

  it('shows the description text', () => {
    expect(
      screen.getByText(/have questions, feedback, or want to get involved/i)
    ).toBeInTheDocument()
  })

  it('displays the email address', () => {
    expect(screen.getByText('info@mapthemess.uk')).toBeInTheDocument()
  })

  it('has a mailto link for the email', () => {
    const emailLink = screen.getByRole('link', { name: /info@mapthemess.uk/i })
    expect(emailLink).toHaveAttribute('href', 'mailto:info@mapthemess.uk')
  })

  it('displays the GitHub repo link', () => {
    const githubLink = screen.getByRole('link', { name: /github\.com\/max246\/Map-the-mess/i })
    expect(githubLink).toHaveAttribute('href', 'https://github.com/max246/Map-the-mess')
  })

  it('opens GitHub link in a new tab', () => {
    const githubLink = screen.getByRole('link', { name: /github\.com\/max246\/Map-the-mess/i })
    expect(githubLink).toHaveAttribute('target', '_blank')
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
