import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import LocationPicker from '../components/LocationPicker'
import { autosuggest } from '../api/w3w'
import { useAuth } from '../context/AuthContext'

export default function ReportLitter() {
  const { token } = useAuth()
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState([])
  const [photoPreviews, setPhotoPreviews] = useState([])
  const [location, setLocation] = useState(null)
  const photoInputRef = useRef(null)
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submittedReportId, setSubmittedReportId] = useState(null)
  const [words, setWords] = useState('')
  const [wordsInput, setWordsInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestTimeout = useRef(null)
  const blurTimeout = useRef(null)

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

  const handleWordsInput = (value) => {
    setWordsInput(value)
    clearTimeout(suggestTimeout.current)

    if (value.includes('.') && value.length >= 4) {
      suggestTimeout.current = setTimeout(() => {
        autosuggest(value, location).then(results => {
          setSuggestions(results)
          setShowSuggestions(results.length > 0)
        })
      }, 300)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const selectSuggestion = (suggestion) => {
    setWords(suggestion.words)
    setWordsInput(suggestion.words)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handlePhotos = (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setPhotos(prev => [...prev, ...files])

    files.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreviews(prev => [...prev, reader.result])
      }
      reader.readAsDataURL(file)
    })

    photoInputRef.current.value = ''
  }

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!location) {
      alert('Please share your location before submitting.')
      return
    }
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('latitude', location.lat)
      formData.append('longitude', location.lng)
      formData.append('description', description)
      if (words) formData.append('what3words', words)
      photos.forEach(file => formData.append('images', file))

      const headers = { 'Content-Type': 'multipart/form-data' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await api.post('/api/reports/', formData, { headers })
      setSubmittedReportId(res.data.id)
    } catch (err) {
      alert('Failed to submit report. Please try again.')
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
          {photoPreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-2">
              {photoPreviews.map((preview, i) => (
                <div key={i} className="relative">
                  <img
                    src={preview}
                    alt={`Upload ${i + 1}`}
                    className="w-full h-24 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-opacity-70"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => photoInputRef.current.click()}
            className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-brand hover:text-brand transition"
          >
            <span className="text-2xl mb-1">+</span>
            <span className="text-sm">{photoPreviews.length > 0 ? 'Add more photos' : 'Click to upload photos'}</span>
          </button>
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
                <span className="font-medium text-sm block mb-1">what3words <span className="text-gray-400 font-normal">(optional)</span></span>
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
                          clearTimeout(blurTimeout.current)
                          selectSuggestion(s)
                        }}
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <span className="text-brand font-medium text-sm">/// {s.words}</span>
                        <span className="text-xs text-gray-400 ml-2">{s.nearestPlace}, {s.country}</span>
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
