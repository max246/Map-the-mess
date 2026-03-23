import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ReportLitter from '../ReportLitter'
import api from '../../api/client'

jest.mock('../../components/LocationPicker', () => () => <div data-testid="location-picker" />)
jest.mock('../../api/w3w', () => ({ autosuggest: jest.fn() }))
jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    post: jest.fn().mockResolvedValue({ data: { id: 1 } }),
  },
}))

const mockPost = api.post as jest.Mock

function renderReportLitter() {
  return render(
    <MemoryRouter>
      <ReportLitter />
    </MemoryRouter>
  )
}

describe('ReportLitter', () => {
  it('renders the form', () => {
    renderReportLitter()
    expect(screen.getByText(/report litter/i)).toBeInTheDocument()
  })

  it('shows the conditions checkbox', () => {
    renderReportLitter()
    expect(
      screen.getByText(
        /I confirm that I am reporting litter suitable for volunteer litter pickers/i
      )
    ).toBeInTheDocument()
  })

  it('has a link to the disclaimer page in the checkbox', () => {
    renderReportLitter()
    const link = screen.getByRole('link', { name: /conditions and disclaimer/i })
    expect(link).toHaveAttribute('href', '/disclaimer')
  })

  it('submit button is disabled when checkbox is not checked', () => {
    renderReportLitter()
    const button = screen.getByRole('button', { name: /submit report/i })
    expect(button).toBeDisabled()
  })

  it('submit button is enabled after checking the checkbox', async () => {
    const user = userEvent.setup()
    renderReportLitter()

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    const button = screen.getByRole('button', { name: /submit report/i })
    expect(button).toBeEnabled()
  })

  it('unchecking the checkbox disables submit again', async () => {
    const user = userEvent.setup()
    renderReportLitter()

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)
    await user.click(checkbox)

    const button = screen.getByRole('button', { name: /submit report/i })
    expect(button).toBeDisabled()
  })

  it('shows upload progress bar during submission', async () => {
    // Make post call onUploadProgress and then stay pending
    mockPost.mockImplementation(
      (
        _url: string,
        _data: unknown,
        config?: { onUploadProgress?: (e: { loaded: number; total: number }) => void }
      ) => {
        if (config?.onUploadProgress) {
          config.onUploadProgress({ loaded: 50, total: 100 })
        }
        return new Promise(() => {}) // never resolves — stays in uploading state
      }
    )

    const user = userEvent.setup()

    // Mock geolocation so we can set a location
    const mockGeolocation = {
      getCurrentPosition: jest.fn(
        (success: (pos: { coords: { latitude: number; longitude: number } }) => void) => {
          success({ coords: { latitude: 51.5, longitude: -0.1 } })
        }
      ),
    }
    Object.defineProperty(navigator, 'geolocation', { value: mockGeolocation, writable: true })

    renderReportLitter()

    // Set location
    await user.click(screen.getByRole('button', { name: /use my location/i }))

    // Accept conditions
    await user.click(screen.getByRole('checkbox'))

    // Submit
    await user.click(screen.getByRole('button', { name: /submit report/i }))

    // Progress bar should be visible
    await waitFor(() => {
      expect(screen.getByText(/creating report/i)).toBeInTheDocument()
      expect(screen.getByText(/50%/)).toBeInTheDocument()
    })

    // Submit button should be gone
    expect(screen.queryByRole('button', { name: /submit report/i })).not.toBeInTheDocument()
  })
})
