import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LocationPicker from '../LocationPicker'

/* ── mocks ────────────────────────────────────────────── */
let mockMapClickHandler: ((e: { latlng: { lat: number; lng: number } }) => void) | null = null

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children, center }: { children: React.ReactNode; center: [number, number] }) => (
    <div data-testid="map-container" data-center={`${center[0]},${center[1]}`}>
      {children}
      <button
        data-testid="map-click-trigger"
        onClick={() => mockMapClickHandler?.({ latlng: { lat: 52.0, lng: -1.5 } })}
      />
    </div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ position, draggable }: { position: [number, number]; draggable?: boolean }) => (
    <div
      data-testid="marker"
      data-lat={position[0]}
      data-lng={position[1]}
      data-draggable={draggable}
    />
  ),
  useMapEvents: (handlers: { click?: (e: { latlng: { lat: number; lng: number } }) => void }) => {
    if (handlers.click) {
      mockMapClickHandler = handlers.click
    }
  },
}))

jest.mock('leaflet', () => ({
  Marker: jest.fn(),
}))

describe('LocationPicker', () => {
  const defaultPosition = { lat: 51.5074, lng: -0.1278 }
  let onMove: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    onMove = jest.fn()
    mockMapClickHandler = null
  })

  it('renders the map container', () => {
    render(<LocationPicker position={defaultPosition} onMove={onMove} />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('centres map on the given position', () => {
    render(<LocationPicker position={defaultPosition} onMove={onMove} />)
    expect(screen.getByTestId('map-container')).toHaveAttribute('data-center', '51.5074,-0.1278')
  })

  it('renders a tile layer', () => {
    render(<LocationPicker position={defaultPosition} onMove={onMove} />)
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument()
  })

  it('renders a marker at the given position', () => {
    render(<LocationPicker position={defaultPosition} onMove={onMove} />)
    const marker = screen.getByTestId('marker')
    expect(marker).toHaveAttribute('data-lat', '51.5074')
    expect(marker).toHaveAttribute('data-lng', '-0.1278')
  })

  it('renders a draggable marker', () => {
    render(<LocationPicker position={defaultPosition} onMove={onMove} />)
    expect(screen.getByTestId('marker')).toHaveAttribute('data-draggable', 'true')
  })

  it('updates marker when position prop changes', () => {
    const { rerender } = render(<LocationPicker position={defaultPosition} onMove={onMove} />)
    rerender(<LocationPicker position={{ lat: 53.0, lng: -2.0 }} onMove={onMove} />)

    const marker = screen.getByTestId('marker')
    expect(marker).toHaveAttribute('data-lat', '53')
    expect(marker).toHaveAttribute('data-lng', '-2')
  })

  it('calls onMove when map is clicked', async () => {
    const user = userEvent.setup()
    render(<LocationPicker position={defaultPosition} onMove={onMove} />)

    await user.click(screen.getByTestId('map-click-trigger'))

    expect(onMove).toHaveBeenCalledWith({ lat: 52.0, lng: -1.5 })
  })

  it('has the correct container styling', () => {
    const { container } = render(<LocationPicker position={defaultPosition} onMove={onMove} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('h-64')
    expect(wrapper.className).toContain('rounded-lg')
  })
})
