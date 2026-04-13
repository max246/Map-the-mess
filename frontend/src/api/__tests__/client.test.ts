/* eslint-disable @typescript-eslint/no-explicit-any */

var mockOnResponseError: any

jest.mock('axios', () => {
  const mockInstance = {
    interceptors: {
      request: { use: jest.fn() },
      response: {
        use: jest.fn((_ok: any, mockOnErr: any) => {
          mockOnResponseError = mockOnErr
        }),
      },
    },
  }
  return {
    __esModule: true,
    default: { create: jest.fn(() => mockInstance) },
  }
})

jest.mock('../../context/AuthContext', () => ({
  tryRefreshToken: jest.fn(),
  authBridge: { updateToken: jest.fn(), handleSessionExpired: jest.fn() },
}))

// Import triggers interceptor registration on the mock axios instance
import '../client'

describe('axios response interceptor', () => {
  let alertSpy: jest.SpiedFunction<typeof window.alert>

  beforeEach(() => {
    alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    alertSpy.mockRestore()
  })

  it('shows an alert when a 413 response is received', async () => {
    const error = {
      response: { status: 413 },
      config: {},
    }

    await expect(mockOnResponseError(error)).rejects.toBe(error)
    expect(alertSpy).toHaveBeenCalledWith(
      'The image is too large to upload. Please use a smaller image (max 50 MB).'
    )
  })

  it('does not show an alert for other error statuses', async () => {
    const error = {
      response: { status: 500 },
      config: {},
    }

    await expect(mockOnResponseError(error)).rejects.toBe(error)
    expect(alertSpy).not.toHaveBeenCalled()
  })
})
