import { useEffect, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'

interface DateTimePickerProps {
  value: string
  onChange: (value: string) => void
  mode?: 'datetime' | 'date'
  placeholder?: string
  id?: string
}

function parseLocal(value: string): Date | undefined {
  if (!value) return undefined
  const [y, mo, d] = value.slice(0, 10).split('-').map(Number)
  if (!y || !mo || !d) return undefined
  const [h = 0, mi = 0] = value.length >= 16 ? value.slice(11, 16).split(':').map(Number) : []
  return new Date(y, mo - 1, d, h, mi)
}

function formatDatePart(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function DateTimePicker({
  value,
  onChange,
  mode = 'datetime',
  placeholder,
  id,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const selected = parseLocal(value)
  const timePart = mode === 'datetime' && value.length >= 16 ? value.slice(11, 16) : '09:00'

  const display = selected
    ? mode === 'datetime'
      ? selected.toLocaleString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : selected.toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
    : placeholder || (mode === 'datetime' ? 'Pick date & time' : 'Pick a date')

  const handleSelect = (day: Date | undefined) => {
    if (!day) {
      onChange('')
      return
    }
    const datePart = formatDatePart(day)
    if (mode === 'date') {
      onChange(datePart)
      setOpen(false)
    } else {
      onChange(`${datePart}T${timePart}`)
    }
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value || '09:00'
    const datePart = selected ? formatDatePart(selected) : formatDatePart(new Date())
    onChange(`${datePart}T${newTime}`)
  }

  const handleClear = () => {
    onChange('')
    setOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-left hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand ${selected ? 'text-gray-900' : 'text-gray-400'}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-500 flex-shrink-0"
        >
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span className="flex-1 truncate">{display}</span>
        {selected && (
          <span
            role="button"
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation()
              handleClear()
            }}
            className="text-gray-400 hover:text-gray-600 text-xs px-1"
          >
            ✕
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-[1100] mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            weekStartsOn={1}
            showOutsideDays
          />
          {mode === 'datetime' && (
            <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-3">
              <label className="text-xs text-gray-500">Time</label>
              <input
                type="time"
                value={timePart}
                onChange={handleTimeChange}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto text-xs text-brand underline"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
