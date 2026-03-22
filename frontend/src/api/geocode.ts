interface GeocodedAddress {
  road: string
  city: string
  postcode: string
  displayName: string
}

const cache = new Map<string, GeocodedAddress>()

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodedAddress> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
  if (cache.has(key)) return cache.get(key)!

  let res: Response | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    if (res.status !== 429) break
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
  }
  if (!res || !res.ok) throw new Error('Geocode failed')
  const data = await res.json()
  const addr = data.address || {}
  const result: GeocodedAddress = {
    road: addr.road || addr.pedestrian || addr.footway || '',
    city: addr.city || addr.town || addr.village || addr.hamlet || '',
    postcode: addr.postcode || '',
    displayName: [
      addr.road || addr.pedestrian || addr.footway || '',
      addr.city || addr.town || addr.village || addr.hamlet || '',
      addr.postcode || '',
    ]
      .filter(Boolean)
      .join(', '),
  }
  cache.set(key, result)
  return result
}
