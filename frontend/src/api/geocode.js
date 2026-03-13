const cache = new Map()

export async function reverseGeocode(lat, lng) {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
  if (cache.has(key)) return cache.get(key)

  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
    { headers: { 'Accept-Language': 'en' } }
  )
  const data = await res.json()
  const addr = data.address || {}
  const result = {
    road: addr.road || addr.pedestrian || addr.footway || '',
    city: addr.city || addr.town || addr.village || addr.hamlet || '',
    postcode: addr.postcode || '',
    displayName: [
      addr.road || addr.pedestrian || addr.footway || '',
      addr.city || addr.town || addr.village || addr.hamlet || '',
      addr.postcode || ''
    ].filter(Boolean).join(', ')
  }
  cache.set(key, result)
  return result
}
