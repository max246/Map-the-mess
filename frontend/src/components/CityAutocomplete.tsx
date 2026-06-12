import { useState, useEffect, useRef } from 'react'

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
}

interface CityAutocompleteProps {
  onSelect: (displayName: string, lat: number, lon: number) => void
  onCancel?: () => void
  placeholder?: string
}

export default function CityAutocomplete({
  onSelect,
  onCancel,
  placeholder = 'Start typing your city...',
}: CityAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tooShort = query.length < 2
  const [wasTooShort, setWasTooShort] = useState(tooShort)
  if (tooShort !== wasTooShort) {
    setWasTooShort(tooShort)
    if (tooShort) setSuggestions([])
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      return
    }
    debounceRef.current = setTimeout(() => {
      fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&featuretype=city&countrycodes=gb`
      )
        .then((r) => r.json())
        .then((results: NominatimResult[]) => setSuggestions(results))
        .catch(() => setSuggestions([]))
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleSelect = (result: NominatimResult) => {
    setSuggestions([])
    setQuery('')
    onSelect(result.display_name, parseFloat(result.lat), parseFloat(result.lon))
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        placeholder={placeholder}
        autoFocus
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition"
              >
                {s.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-1 text-xs text-gray-500 hover:underline"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
