import type { EventRead } from '../api/model'

const EVENT_DURATION_MS = 2 * 60 * 60 * 1000 // 2 hours

/** Format a Date as an ICS datetime string: YYYYMMDDTHHmmssZ */
function formatIcsDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

/** Escape special characters for ICS text fields (RFC 5545 §3.3.11). */
function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** Strip basic markdown syntax to produce plain text. */
function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, '') // headings
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1') // italic
    .replace(/__(.+?)__/g, '$1') // bold alt
    .replace(/_(.+?)_/g, '$1') // italic alt
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // images
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // inline code
    .replace(/^\s*[-*+]\s+/gm, '- ') // list markers
    .replace(/^\s*>\s+/gm, '') // blockquotes
    .trim()
}

/** Fold lines longer than 75 octets per RFC 5545 §3.1. */
function foldLine(line: string): string {
  const MAX = 75
  if (line.length <= MAX) return line
  const parts: string[] = [line.slice(0, MAX)]
  let i = MAX
  while (i < line.length) {
    parts.push(' ' + line.slice(i, i + MAX - 1))
    i += MAX - 1
  }
  return parts.join('\r\n')
}

/** Generate an ICS (iCalendar) file content string for an event. */
export function generateIcsContent(event: EventRead, communityName: string): string {
  const start = new Date(event.date)
  const end = new Date(start.getTime() + EVENT_DURATION_MS)
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${event.meeting_latitude},${event.meeting_longitude}`

  const description = event.description
    ? stripMarkdown(event.description) + `\n\nMeeting point: ${mapsUrl}`
    : `Meeting point: ${mapsUrl}`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Map the Mess//Community Cleanup//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@mapthemess`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(`${event.title} — ${communityName}`)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(mapsUrl)}`,
    `GEO:${event.meeting_latitude};${event.meeting_longitude}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.map(foldLine).join('\r\n')
}

/** Trigger a browser download of the event as an .ics file. */
export function downloadIcsFile(event: EventRead, communityName: string): void {
  const content = generateIcsContent(event, communityName)
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.title.replace(/[^a-zA-Z0-9-_ ]/g, '')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

/** Build a Google Calendar "create event" deep link URL. */
export function buildGoogleCalendarUrl(event: EventRead, communityName: string): string {
  const start = new Date(event.date)
  const end = new Date(start.getTime() + EVENT_DURATION_MS)
  const fmt = (d: Date) => formatIcsDate(d) // same YYYYMMDDTHHmmssZ format

  const description = event.description ? stripMarkdown(event.description) : ''

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${event.title} — ${communityName}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: description,
    location: `${event.meeting_latitude},${event.meeting_longitude}`,
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
