import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { forwardRef as mockForwardRef } from 'react'

/* ── mock data ─────────────────────────────────────────── */
const REPORTS = [
  {
    id: 1,
    description: 'Bottles on path',
    status: 'reported',
    latitude: 51.5,
    longitude: -0.1,
    created_at: '2026-01-01',
    what3words: 'fill.count.soap',
    images: [],
  },
  {
    id: 2,
    description: 'Bags in park',
    status: 'cleaned',
    latitude: 52.0,
    longitude: -1.0,
    created_at: '2026-01-02',
    what3words: '',
    images: [],
  },
  {
    id: 3,
    description: 'Cans near bus stop',
    status: 'reported',
    latitude: 53.0,
    longitude: -2.0,
    created_at: '2026-01-03',
    what3words: '',
    images: [],
  },
]

/* ── mocks ────────────────────────────────────────────── */
const mockListReports = jest.fn()
const mockListFavourites = jest.fn()
const mockListBins = jest.fn()
const mockDeleteBin = jest.fn()
const mockCreateBin = jest.fn()
const mockFlyTo = jest.fn()
const mockGetZoom = jest.fn()
const mockGetCenter = jest.fn()

const mockAuthState = { isLoggedIn: false }

const mockMapHandlers: Record<string, (...args: unknown[]) => void> = {}
const mockMapOn = jest.fn((event: string, fn: (...args: unknown[]) => void) => {
  mockMapHandlers[event] = fn
})
const mockMapOff = jest.fn((event: string) => {
  delete mockMapHandlers[event]
})

const mockMapEventHandlers: Record<string, (...args: unknown[]) => void> = {}
const mockUseMapEvents = jest.fn(
  (handlers: Record<string, (...args: unknown[]) => void>) => {
    Object.assign(mockMapEventHandlers, handlers)
    return null
  }
)

jest.mock('../../api/endpoints/reports/reports', () => ({
  getReports: () => ({
    listReportsApiReportsGet: (...args: unknown[]) => mockListReports(...args),
  }),
}))

jest.mock('../../api/endpoints/volunteers/volunteers', () => ({
  getVolunteers: () => ({
    listFavouritesApiVolunteersFavouritesGet: (...args: unknown[]) => mockListFavourites(...args),
  }),
}))

jest.mock('../../api/endpoints/bins/bins', () => ({
  getBins: () => ({
    listBinsApiBinsGet: (...args: unknown[]) => mockListBins(...args),
    deleteBinApiBinsBinIdDelete: (...args: unknown[]) => mockDeleteBin(...args),
    createBinApiBinsPost: (...args: unknown[]) => mockCreateBin(...args),
  }),
}))

jest.mock('../../components/BinsLayer', () => () => null)
jest.mock('../../components/BinFormModal', () => () => null)

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}))

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  thumbnailUrl: () => 'thumb.jpg',
}))

// Mock react-leaflet components to render testable HTML
jest.mock('react-leaflet', () => {
  return {
    MapContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="map-container">{children}</div>
    ),
    TileLayer: () => <div data-testid="tile-layer" />,
    Marker: mockForwardRef<
      HTMLDivElement,
      {
        children: React.ReactNode
        eventHandlers?: { click?: () => void }
        position: [number, number]
      }
    >(({ children, eventHandlers, position }, _ref) => (
      <div
        data-testid="marker"
        data-lat={position[0]}
        data-lng={position[1]}
        onClick={eventHandlers?.click}
      >
        {children}
      </div>
    )),
    Popup: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="popup">{children}</div>
    ),
    useMap: () => ({
      flyTo: mockFlyTo,
      getZoom: mockGetZoom,
      getCenter: mockGetCenter,
      removeLayer: jest.fn(),
      on: mockMapOn,
      off: mockMapOff,
    }),
    useMapEvents: (handlers: Record<string, (...args: unknown[]) => void>) =>
      mockUseMapEvents(handlers),
  }
})

jest.mock('react-leaflet-cluster', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="cluster-group">{children}</div>
  ),
}))

jest.mock('../../components/LocateButton', () => () => <button data-testid="locate-button" />)

const mockLayerGroup = {
  addTo: jest.fn().mockReturnThis(),
  remove: jest.fn(),
  clearLayers: jest.fn(),
}

const mockHeatLayer = {
  addTo: jest.fn().mockReturnThis(),
  remove: jest.fn(),
}
const mockHeatLayerFn = jest.fn(() => mockHeatLayer)

jest.mock('leaflet', () => ({
  icon: () => ({}),
  layerGroup: () => mockLayerGroup,
  circle: () => ({ addTo: jest.fn() }),
  divIcon: () => ({}),
  marker: () => ({ addTo: jest.fn() }),
  heatLayer: (...args: unknown[]) => mockHeatLayerFn(...args),
}))

jest.mock('leaflet.heat', () => ({}))

import MapView from '../MapView'

function renderMapView() {
  return render(
    <MemoryRouter>
      <MapView />
    </MemoryRouter>
  )
}

describe('MapView', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthState.isLoggedIn = false
    Object.keys(mockMapHandlers).forEach((k) => delete mockMapHandlers[k])
    Object.keys(mockMapEventHandlers).forEach((k) => delete mockMapEventHandlers[k])
    mockListReports.mockResolvedValue(REPORTS)
    mockListFavourites.mockResolvedValue([])
    mockListBins.mockResolvedValue([])
    mockGetZoom.mockReturnValue(6)
    mockGetCenter.mockReturnValue({ lat: 53.5, lng: -1.5 })
  })

  it('renders the map container', async () => {
    renderMapView()
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('shows filter buttons after expanding status panel', async () => {
    const user = userEvent.setup()
    renderMapView()
    await user.click(screen.getByTitle('Status filter'))
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unresolved' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resolved' })).toBeInTheDocument()
  })

  it('does not show Favourites filter when logged out', async () => {
    const user = userEvent.setup()
    renderMapView()
    await user.click(screen.getByTitle('Status filter'))
    expect(screen.queryByRole('button', { name: 'Favourites' })).not.toBeInTheDocument()
  })

  it('defaults to unresolved filter and shows only unresolved markers', async () => {
    renderMapView()
    await waitFor(() => {
      expect(screen.getAllByTestId('marker')).toHaveLength(2)
    })
    expect(screen.getByText(/Bottles on path/)).toBeInTheDocument()
    expect(screen.getByText(/Cans near bus stop/)).toBeInTheDocument()
    expect(screen.queryByText(/Bags in park/)).not.toBeInTheDocument()
  })

  /* ── Filtering ──────────────────────────────────── */

  it('shows all reports when All filter is clicked', async () => {
    const user = userEvent.setup()
    renderMapView()

    await waitFor(() => {
      expect(screen.getAllByTestId('marker')).toHaveLength(2)
    })

    await user.click(screen.getByTitle('Status filter'))
    await user.click(screen.getByRole('button', { name: 'All' }))

    await waitFor(() => {
      expect(screen.getAllByTestId('marker')).toHaveLength(3)
    })
  })

  it('filters to resolved reports only', async () => {
    const user = userEvent.setup()
    renderMapView()

    await waitFor(() => {
      expect(screen.getAllByTestId('marker')).toHaveLength(2)
    })

    await user.click(screen.getByTitle('Status filter'))
    await user.click(screen.getByRole('button', { name: 'Resolved' }))

    await waitFor(() => {
      expect(screen.getAllByTestId('marker')).toHaveLength(1)
    })
    expect(screen.getByText(/Bags in park/)).toBeInTheDocument()
  })

  it('switches back to all reports', async () => {
    const user = userEvent.setup()
    renderMapView()

    await waitFor(() => {
      expect(screen.getAllByTestId('marker')).toHaveLength(2)
    })

    await user.click(screen.getByTitle('Status filter'))
    await user.click(screen.getByRole('button', { name: 'All' }))
    await waitFor(() => {
      expect(screen.getAllByTestId('marker')).toHaveLength(3)
    })

    await user.click(screen.getByRole('button', { name: 'Unresolved' }))
    await waitFor(() => {
      expect(screen.getAllByTestId('marker')).toHaveLength(2)
    })
  })

  /* ── Marker click / zoom ────────────────────────── */

  it('zooms in when clicking a marker at low zoom', async () => {
    mockGetZoom.mockReturnValue(6)
    const user = userEvent.setup()
    renderMapView()

    await waitFor(() => {
      expect(screen.getAllByTestId('marker')).toHaveLength(2)
    })

    await user.click(screen.getAllByTestId('marker')[0])

    expect(mockFlyTo).toHaveBeenCalledWith([51.5, -0.1], 15)
  })

  it('does not zoom when already zoomed in', async () => {
    mockGetZoom.mockReturnValue(16)
    const user = userEvent.setup()
    renderMapView()

    await waitFor(() => {
      expect(screen.getAllByTestId('marker')).toHaveLength(2)
    })

    await user.click(screen.getAllByTestId('marker')[0])

    expect(mockFlyTo).not.toHaveBeenCalled()
  })

  /* ── Popup content ──────────────────────────────── */

  it('shows report description in popup', async () => {
    renderMapView()
    await waitFor(() => {
      expect(screen.getByText(/Bottles on path/)).toBeInTheDocument()
    })
  })

  it('shows status icons in popups', async () => {
    renderMapView()
    await waitFor(() => {
      expect(screen.getAllByTestId('popup')).toHaveLength(2)
    })
  })

  it('shows what3words in popup when available', async () => {
    renderMapView()
    await waitFor(() => {
      expect(screen.getByText(/fill\.count\.soap/)).toBeInTheDocument()
    })
  })

  it('shows Open Report button in popups', async () => {
    renderMapView()
    await waitFor(() => {
      const buttons = screen.getAllByRole('button', { name: /open report/i })
      expect(buttons.length).toBeGreaterThan(0)
    })
  })

  /* ── Layer toggle ───────────────────────────────── */

  it('shows Pins and Heatmap layer buttons after expanding layer panel', async () => {
    const user = userEvent.setup()
    renderMapView()
    await user.click(screen.getByTitle('Layer toggle'))
    expect(screen.getByRole('button', { name: 'Pins' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Heatmap' })).toBeInTheDocument()
  })

  it('defaults to pins layer with cluster group visible', async () => {
    renderMapView()
    await waitFor(() => {
      expect(screen.getByTestId('cluster-group')).toBeInTheDocument()
    })
  })

  it('switches to heatmap layer and hides markers', async () => {
    const user = userEvent.setup()
    renderMapView()

    await waitFor(() => {
      expect(screen.getAllByTestId('marker')).toHaveLength(2)
    })

    await user.click(screen.getByTitle('Layer toggle'))
    await user.click(screen.getByRole('button', { name: 'Heatmap' }))

    await waitFor(() => {
      expect(screen.queryByTestId('cluster-group')).not.toBeInTheDocument()
    })
    expect(mockHeatLayerFn).toHaveBeenCalled()
  })

  it('switches back to pins from heatmap', async () => {
    const user = userEvent.setup()
    renderMapView()

    await waitFor(() => {
      expect(screen.getAllByTestId('marker')).toHaveLength(2)
    })

    await user.click(screen.getByTitle('Layer toggle'))
    await user.click(screen.getByRole('button', { name: 'Heatmap' }))
    await waitFor(() => {
      expect(screen.queryByTestId('cluster-group')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Pins' }))
    await waitFor(() => {
      expect(screen.getByTestId('cluster-group')).toBeInTheDocument()
    })
  })

  /* ── Bin add via long-press ─────────────────────── */

  describe('Bin add via long-press', () => {
    const triggerLongPress = (lat = 60.123, lng = -5.678) => {
      act(() => {
        mockMapHandlers.mousedown?.({
          latlng: { lat, lng },
          originalEvent: { target: null },
        } as unknown)
        jest.advanceTimersByTime(500)
      })
    }

    it('does not render the standalone "Add bin" button when logged in', () => {
      mockAuthState.isLoggedIn = true
      renderMapView()
      // The popup button only appears after long-press; no standalone button should exist.
      expect(screen.queryByRole('button', { name: 'Add bin' })).not.toBeInTheDocument()
    })

    it('does not register a mousedown long-press handler when logged out', () => {
      mockAuthState.isLoggedIn = false
      renderMapView()
      expect(mockMapOn).not.toHaveBeenCalledWith('mousedown', expect.any(Function))
    })

    it('registers the mousedown long-press handler when logged in', () => {
      mockAuthState.isLoggedIn = true
      renderMapView()
      expect(mockMapOn).toHaveBeenCalledWith('mousedown', expect.any(Function))
    })

    it('drops a pending bin pin with description form after a 500ms hold', () => {
      mockAuthState.isLoggedIn = true
      jest.useFakeTimers()
      try {
        renderMapView()
        triggerLongPress()
        expect(screen.getByText('🗑️ Add a bin here?')).toBeInTheDocument()
        expect(screen.getByPlaceholderText(/Description/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add bin' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      } finally {
        jest.useRealTimers()
      }
    })

    it('submits createBinApiBinsPost with description and coordinates', async () => {
      mockAuthState.isLoggedIn = true
      mockCreateBin.mockResolvedValue({ id: 'b1' })
      jest.useFakeTimers()
      try {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
        renderMapView()
        triggerLongPress(51.5, -0.12)

        await user.type(
          screen.getByPlaceholderText(/Description/i),
          'Next to the bus stop'
        )
        await user.click(screen.getByRole('button', { name: 'Add bin' }))

        await waitFor(() => {
          expect(mockCreateBin).toHaveBeenCalledWith({
            latitude: 51.5,
            longitude: -0.12,
            description: 'Next to the bus stop',
          })
        })
        await waitFor(() => {
          expect(screen.queryByText('🗑️ Add a bin here?')).not.toBeInTheDocument()
        })
      } finally {
        jest.useRealTimers()
      }
    })

    it('removes the pending pin without API call when Cancel is clicked', async () => {
      mockAuthState.isLoggedIn = true
      jest.useFakeTimers()
      try {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
        renderMapView()
        triggerLongPress()
        expect(screen.getByText('🗑️ Add a bin here?')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Cancel' }))

        expect(screen.queryByText('🗑️ Add a bin here?')).not.toBeInTheDocument()
        expect(mockCreateBin).not.toHaveBeenCalled()
      } finally {
        jest.useRealTimers()
      }
    })

    it('moves the pending pin when the map is tapped elsewhere', () => {
      mockAuthState.isLoggedIn = true
      jest.useFakeTimers()
      try {
        renderMapView()
        triggerLongPress(60.0, -5.0)

        const startMarker = screen
          .getAllByTestId('marker')
          .find((m) => m.getAttribute('data-lat') === '60')
        expect(startMarker).toBeDefined()

        act(() => {
          mockMapEventHandlers.click?.({ latlng: { lat: 61.5, lng: -4.25 } } as unknown)
        })

        const movedMarker = screen
          .getAllByTestId('marker')
          .find((m) => m.getAttribute('data-lat') === '61.5')
        expect(movedMarker).toBeDefined()
        expect(
          screen.getAllByTestId('marker').find((m) => m.getAttribute('data-lat') === '60')
        ).toBeUndefined()
      } finally {
        jest.useRealTimers()
      }
    })
  })
})
