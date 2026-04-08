import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

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
const mockFlyTo = jest.fn()
const mockGetZoom = jest.fn()

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

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isLoggedIn: false }),
}))

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  thumbnailUrl: () => 'thumb.jpg',
}))

// Mock react-leaflet components to render testable HTML
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({
    children,
    eventHandlers,
    position,
  }: {
    children: React.ReactNode
    eventHandlers?: { click?: () => void }
    position: [number, number]
  }) => (
    <div
      data-testid="marker"
      data-lat={position[0]}
      data-lng={position[1]}
      onClick={eventHandlers?.click}
    >
      {children}
    </div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({
    flyTo: mockFlyTo,
    getZoom: mockGetZoom,
    removeLayer: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  }),
}))

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
    mockListReports.mockResolvedValue(REPORTS)
    mockListFavourites.mockResolvedValue([])
    mockGetZoom.mockReturnValue(6)
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
})
