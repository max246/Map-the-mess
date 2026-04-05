import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CityAutocomplete from '../CityAutocomplete'

const NOMINATIM_RESULTS = [
  { display_name: 'London, England, United Kingdom', lat: '51.5074', lon: '-0.1278' },
  { display_name: 'Londonderry, Northern Ireland, United Kingdom', lat: '54.9966', lon: '-7.3086' },
]

beforeEach(() => {
  jest.useFakeTimers()
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

function mockFetchResults(results = NOMINATIM_RESULTS) {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    json: () => Promise.resolve(results),
  })
}

describe('CityAutocomplete', () => {
  it('renders the input with default placeholder', () => {
    render(<CityAutocomplete onSelect={jest.fn()} />)
    expect(screen.getByPlaceholderText('Start typing your city...')).toBeInTheDocument()
  })

  it('renders custom placeholder', () => {
    render(<CityAutocomplete onSelect={jest.fn()} placeholder="Find your town" />)
    expect(screen.getByPlaceholderText('Find your town')).toBeInTheDocument()
  })

  it('does not fetch when query is less than 2 characters', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<CityAutocomplete onSelect={jest.fn()} />)

    await user.type(screen.getByRole('textbox'), 'L')
    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches suggestions after debounce when typing 2+ characters', async () => {
    mockFetchResults()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<CityAutocomplete onSelect={jest.fn()} />)

    await user.type(screen.getByRole('textbox'), 'Lon')
    act(() => {
      jest.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('Lon')
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('countrycodes=gb')
  })

  it('displays suggestions from Nominatim response', async () => {
    mockFetchResults()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<CityAutocomplete onSelect={jest.fn()} />)

    await user.type(screen.getByRole('textbox'), 'Lon')
    act(() => {
      jest.advanceTimersByTime(300)
    })

    expect(await screen.findByText('London, England, United Kingdom')).toBeInTheDocument()
    expect(screen.getByText('Londonderry, Northern Ireland, United Kingdom')).toBeInTheDocument()
  })

  it('calls onSelect with parsed coordinates when a suggestion is clicked', async () => {
    mockFetchResults()
    const onSelect = jest.fn()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<CityAutocomplete onSelect={onSelect} />)

    await user.type(screen.getByRole('textbox'), 'Lon')
    act(() => {
      jest.advanceTimersByTime(300)
    })

    await user.click(await screen.findByText('London, England, United Kingdom'))

    expect(onSelect).toHaveBeenCalledWith('London, England, United Kingdom', 51.5074, -0.1278)
  })

  it('clears suggestions and query after selection', async () => {
    mockFetchResults()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<CityAutocomplete onSelect={jest.fn()} />)

    await user.type(screen.getByRole('textbox'), 'Lon')
    act(() => {
      jest.advanceTimersByTime(300)
    })

    await user.click(await screen.findByText('London, England, United Kingdom'))

    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(screen.queryByText('London, England, United Kingdom')).not.toBeInTheDocument()
  })

  it('shows Cancel button when onCancel is provided', () => {
    render(<CityAutocomplete onSelect={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('does not show Cancel button when onCancel is not provided', () => {
    render(<CityAutocomplete onSelect={jest.fn()} />)
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = jest.fn()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<CityAutocomplete onSelect={jest.fn()} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('handles fetch failure gracefully', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<CityAutocomplete onSelect={jest.fn()} />)

    await user.type(screen.getByRole('textbox'), 'Lon')
    act(() => {
      jest.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
    // No suggestions shown, no crash
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})
