const STORAGE_KEY = 'mtm:lastLocatedPosition'
const TTL_MS = 5 * 60 * 1000

export interface SavedLocation {
  lat: number
  lng: number
}

interface StoredLocation extends SavedLocation {
  savedAt: number
}

export function saveLocatedPosition(pos: SavedLocation): void {
  try {
    const payload: StoredLocation = { ...pos, savedAt: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // localStorage unavailable (private mode, quota); silently ignore
  }
}

export function getSavedLocatedPosition(): SavedLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredLocation
    if (
      typeof parsed?.lat !== 'number' ||
      typeof parsed?.lng !== 'number' ||
      typeof parsed?.savedAt !== 'number'
    ) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    if (Date.now() - parsed.savedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return { lat: parsed.lat, lng: parsed.lng }
  } catch {
    return null
  }
}
