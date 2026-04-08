import { useState, useRef, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import LocationPicker from '../components/LocationPicker'
import { autosuggest } from '../api/w3w'
import type { W3WSuggestion } from '../api/w3w'
import api from '../api/client'

export default function ReportLitter() {
  const [reportType, setReportType] = useState('litter')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadLabel, setUploadLabel] = useState('')
  const [submittedReportId, setSubmittedReportId] = useState<number | null>(null)
  const [words, setWords] = useState('')
  const [wordsInput, setWordsInput] = useState('')
  const [acceptedConditions, setAcceptedConditions] = useState(false)
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

  const uploadFile = (url: string, formData: FormData, fileIndex: number, totalFiles: number) => {
    return api.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
      onUploadProgress: (e) => {
        const fileProgress = e.total ? e.loaded / e.total : 0
        const overall = ((fileIndex + fileProgress) / totalFiles) * 100
        setUploadProgress(Math.round(overall))
      },
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!reportType) {
      alert('Please select a report type.')
      return
    }
    if (!location) {
      alert('Please share your location before submitting.')
      return
    }
    setSubmitting(true)
    setUploadProgress(0)

    const totalFiles = Math.max(photos.length, 1)

    try {
      // Create report with first image (if any)
      setUploadLabel(
        photos.length > 0 ? `Uploading photo 1 of ${photos.length}...` : 'Creating report...'
      )
      const formData = new FormData()
      formData.append('latitude', location.lat.toString())
      formData.append('longitude', location.lng.toString())
      formData.append('report_type', reportType)
      formData.append('description', description)
      if (words) formData.append('what3words', words)
      if (photos[0]) formData.append('image', photos[0])

      const res = await uploadFile('/api/reports/', formData, 0, totalFiles)
      const report = res.data

      // Upload remaining images
      for (let i = 1; i < photos.length; i++) {
        setUploadLabel(`Uploading photo ${i + 1} of ${photos.length}...`)
        const imgData = new FormData()
        imgData.append('image_type', 'report')
        imgData.append('file', photos[i])
        await uploadFile(`/api/reports/${report.id}/images`, imgData, i, totalFiles)
      }

      setUploadProgress(100)
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
      setUploadProgress(0)
      setUploadLabel('')
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
              setReportType('litter')
              setDescription('')
              setPhotos([])
              setPhotoPreviews([])
              setLocation(null)
              setWords('')
              setWordsInput('')
              setAcceptedConditions(false)
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
      <PageMeta
        title="Report Litter"
        description="Spotted litter? Report it with a photo and location so volunteers can find and clean it up."
      />
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

        <fieldset className="flex flex-col gap-1">
          <legend className="font-medium">
            Type <span className="text-red-500">*</span>
          </legend>
          <div className="flex gap-3">
            <label
              className={`flex-1 flex items-center justify-center gap-2 border-2 rounded-lg py-3 px-4 cursor-pointer transition ${
                reportType === 'litter'
                  ? 'border-brand bg-brand/5 text-brand font-semibold'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="report_type"
                value="litter"
                checked={reportType === 'litter'}
                onChange={(e) => setReportType(e.target.value)}
                className="sr-only"
              />
              Litter
            </label>
            <label
              className={`flex-1 flex items-center justify-center gap-2 border-2 rounded-lg py-3 px-4 cursor-pointer transition ${
                reportType === 'gas_canister'
                  ? 'border-brand bg-brand/5 text-brand font-semibold'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="report_type"
                value="gas_canister"
                checked={reportType === 'gas_canister'}
                onChange={(e) => setReportType(e.target.value)}
                className="sr-only"
              />
              Gas Canister
            </label>
          </div>
        </fieldset>

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

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedConditions}
              onChange={(e) => setAcceptedConditions(e.target.checked)}
              className="mt-1 h-4 w-4 accent-brand"
            />
            <span className="text-sm text-gray-700">
              I confirm that I am reporting litter suitable for volunteer litter pickers, not
              fly-tipping or large-scale dumping. I have read and agree to the{' '}
              <Link to="/disclaimer" className="text-brand hover:underline font-medium">
                conditions and disclaimer
              </Link>
              .
            </span>
          </label>
        </div>

        {submitting ? (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-medium text-gray-600">
              <span>{uploadLabel}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-brand h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            type="submit"
            disabled={!acceptedConditions}
            className="bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            Submit Report
          </button>
        )}
      </form>
    </div>
  )
}
