/**
 * Backend stores naive UTC datetimes (no offset). When serialised they look
 * like "2026-05-15T19:00:00", which `new Date()` interprets as *local* time —
 * shifting display by the user's offset (e.g. BST shows 18:00 for an event
 * stored at 19:00 UTC).
 *
 * Use these helpers whenever you read a datetime field from the API.
 */

const HAS_TZ = /(Z|[+-]\d{2}:?\d{2})$/

export function parseUtcDate(value: string): Date {
  return new Date(HAS_TZ.test(value) ? value : `${value}Z`)
}

export function formatUtcDateTime(value: string, locale = 'en-GB'): string {
  return parseUtcDate(value).toLocaleString(locale)
}

export function formatUtcDate(value: string, locale = 'en-GB'): string {
  return parseUtcDate(value).toLocaleDateString(locale)
}
