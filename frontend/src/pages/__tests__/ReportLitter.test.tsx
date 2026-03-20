import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ReportLitter from '../ReportLitter'

jest.mock('../../components/LocationPicker', () => () => <div data-testid="location-picker" />)
jest.mock('../../api/w3w', () => ({ autosuggest: jest.fn() }))
jest.mock('../../api/endpoints/reports/reports', () => ({
  getReports: () => ({
    createReportApiReportsPost: jest.fn(),
    addImageApiReportsReportIdImagesPost: jest.fn(),
  }),
}))

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
})
