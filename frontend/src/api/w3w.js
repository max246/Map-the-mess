const W3W_API_KEY = import.meta.env.VITE_W3W_API_KEY

async function autosuggest(input, focus) {
  if (!W3W_API_KEY || !input) return []
  const params = new URLSearchParams({ input, key: W3W_API_KEY })
  if (focus) {
    params.set('focus', `${focus.lat},${focus.lng}`)
  }
  const res = await fetch(`https://api.what3words.com/v3/autosuggest?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.suggestions || []
}

export { W3W_API_KEY, autosuggest }
