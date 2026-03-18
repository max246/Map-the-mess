import { useState, useRef, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import LocationPicker from '../components/LocationPicker'
import { autosuggest } from '../api/w3w'
import type { W3WSuggestion } from '../api/w3w'
import { getReports } from '../api/endpoints/reports/reports'

const { createReportApiReportsPost, addImageApiReportsReportIdImagesPost } = getReports()

export default function ReportLitter() {
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submittedReportId, setSubmittedReportId] = useState<number | null>(null)
  const [words, setWords] = useState('')
  const [wordsInput, setWordsInput] = useState('')
  const [suggestions, setSuggestions] = useState<W3WSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getLocation = () => {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        alert('Could not get your location. Please allow location access.')
        setLocating(false)
      }
    )
  }

  const handleWordsInput = (value: string) => {
    setWordsInput(value)
    if (suggestTimeout.current) clearTimeout(suggestTimeout.current)

    if (value.includes('.') && value.length >= 4) {
      suggestTimeout.current = setTimeout(() => {
        autosuggest(value, location).then((results) => {
          setSuggestions(results)
          setShowSuggestions(results.length > 0)
        })
      }, 300)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const selectSuggestion = (suggestion: W3WSuggestion) => {
    setWords(suggestion.words)
    setWordsInput(suggestion.words)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handlePhotos = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setPhotos((prev) => [...prev, ...files])

    files.forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreviews((prev) => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })

    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!location) {
      alert('Please share your location before submitting.')
      return
    }
    setSubmitting(true)
    try {
      // Create report with first image (if any)
      const report = await createReportApiReportsPost({
        latitude: location.lat,
        longitude: location.lng,
        description,
        what3words: words || undefined,
        image: photos[0] ?? undefined,
      })

      // Upload remaining images via the add-image endpoint
      for (const file of photos.slice(1)) {
        await addImageApiReportsReportIdImagesPost(report.id, {
          image_type: 'report',
          file,
        })
      }

      setSubmittedReportId(report.id)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 400) {
        alert('Location must be within the United Kingdom.')
      } else {
        alert('Failed to submit report. Please try again.')
      }
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (submittedReportId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-2xl font-bold mb-3">Thanks for helping!</h1>
        <p className="text-gray-600 mb-8">
          Your report has been submitted successfully. Together we can make our community cleaner.
        </p>
        <div className="flex flex-col gap-3 items-center">
          <Link
            to={`/report/${submittedReportId}`}
            className="bg-brand hover:bg-brand-dark text-white font-semibold py-3 px-6 rounded-lg transition inline-block"
          >
            View your report
          </Link>
          <button
            onClick={() => {
              setSubmittedReportId(null)
              setDescription('')
              setPhotos([])
              setPhotoPreviews([])
              setLocation(null)
              setWords('')
              setWordsInput('')
            }}
            className="text-brand underline text-sm"
          >
            Submit another report
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">📸 Report Litter</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="font-medium">Photos</span>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotos}
            className="hidden"
          />
          {photoPreviews.length === 0 ? (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-brand hover:text-brand transition"
            >
              <span className="text-2xl mb-1">+</span>
              <span className="text-sm">Click to upload photos</span>
            </button>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photoPreviews.map((preview, i) => (
                <div key={i} className="relative flex-shrink-0 w-20 h-20">
                  <img
                    src={preview}
                    alt={`Upload ${i + 1}`}
                    className="w-full h-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] hover:bg-opacity-70"
                  >
                    X
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="flex-shrink-0 w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-brand hover:text-brand transition"
              >
                <span className="text-xl">+</span>
              </button>
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What did you see? e.g. Pile of rubbish bags near bus stop"
            rows={3}
            className="border rounded p-2 resize-none"
          />
        </label>

        <div>
          <span className="font-medium block mb-1">Location</span>
          {location ? (
            <>
              <p className="text-sm text-gray-600 mb-2">
                📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </p>

              <div className="mb-2 relative">
                <span className="font-medium text-sm block mb-1">
                  what3words <span className="text-gray-400 font-normal">(optional)</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-brand font-medium text-sm">///</span>
                  <input
                    type="text"
                    value={wordsInput}
                    onChange={(e) => handleWordsInput(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    onBlur={() => {
                      blurTimeout.current = setTimeout(() => {
                        setShowSuggestions(false)
                        if (wordsInput.trim()) {
                          setWords(wordsInput.replace(/^\/+\s*/, '').trim())
                        }
                      }, 200)
                    }}
                    placeholder="e.g. filled.count.soap"
                    className="border rounded px-2 py-1 text-sm flex-1"
                  />
                </div>

                {showSuggestions && (
                  <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((s) => (
                      <li
                        key={s.words}
                        onMouseDown={() => {
                          if (blurTimeout.current) clearTimeout(blurTimeout.current)
                          selectSuggestion(s)
                        }}
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <span className="text-brand font-medium text-sm">/// {s.words}</span>
                        <span className="text-xs text-gray-400 ml-2">
                          {s.nearestPlace}, {s.country}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="text-xs text-gray-400 mt-1">
                  Type a what3words address to search — suggestions will appear
                </p>
              </div>

              <p className="text-xs text-gray-400 mb-2">Drag the pin or tap the map to adjust</p>
              <LocationPicker position={location} onMove={setLocation} />
              <button
                type="button"
                onClick={() => {
                  setLocation(null)
                  setWords('')
                  setWordsInput('')
                }}
                className="mt-2 text-sm text-gray-500 underline"
              >
                Reset location
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={getLocation}
              disabled={locating}
              className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded text-sm"
            >
              {locating ? 'Getting location...' : '📍 Use My Location'}
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  )
}
