import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NewBadgesBanner from '../NewBadgesBanner'
import type { BadgeRead } from '../../api/model'

let mockCtx: { unacknowledged: BadgeRead[] } = { unacknowledged: [] }

jest.mock('../../context/BadgesContext', () => ({
  useBadges: () => mockCtx,
}))

function renderBanner() {
  return render(
    <MemoryRouter>
      <NewBadgesBanner />
    </MemoryRouter>
  )
}

function badge(id: string, name: string): BadgeRead {
  return {
    id,
    name,
    description: '',
    awarded_at: '2026-04-01T00:00:00Z',
    acknowledged_at: null,
  }
}

describe('NewBadgesBanner', () => {
  beforeEach(() => {
    mockCtx = { unacknowledged: [] }
  })

  it('renders nothing when there are no unacknowledged badges', () => {
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })

  it('uses singular copy and names the badge when exactly one is unacknowledged', () => {
    mockCtx = { unacknowledged: [badge('reporter_1', 'First Spotter')] }
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(/you.+earned a new badge.*First Spotter/i)
    // Not the plural copy
    expect(screen.queryByText(/new badges/i)).not.toBeInTheDocument()
  })

  it('uses plural copy with count when multiple are unacknowledged', () => {
    mockCtx = {
      unacknowledged: [
        badge('reporter_1', 'First Spotter'),
        badge('resolver_1', 'First Cleanup'),
        badge('reporter_10', 'Sharp Eye'),
      ],
    }
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(/3 new badges/)
    // Doesn't name individual badges when there are multiple
    expect(screen.queryByText('First Spotter')).not.toBeInTheDocument()
  })

  it('links to the badges section on the volunteer dashboard', () => {
    mockCtx = { unacknowledged: [badge('reporter_1', 'First Spotter')] }
    renderBanner()

    const link = screen.getByRole('link', { name: /view/i })
    expect(link).toHaveAttribute('href', '/volunteers#badges')
  })
})
