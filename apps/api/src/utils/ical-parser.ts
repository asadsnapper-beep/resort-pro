/**
 * iCal Parser — no external dependency
 * Parses raw iCal text and returns an array of VEVENT objects.
 *
 * Handles:
 *  - Multi-line folded values (RFC 5545 §3.1)
 *  - DATE-only values (DTSTART;VALUE=DATE:20260610)
 *  - DATE-TIME values (DTSTART:20260610T140000Z)
 *  - CANCELLED / TENTATIVE status
 */

export interface ICalEvent {
  uid: string
  start: Date
  end: Date
  summary: string
  status: 'CONFIRMED' | 'CANCELLED' | 'TENTATIVE'
}

/**
 * Unfold multi-line values per RFC 5545 §3.1
 * Lines that start with a space or tab are continuations of the previous line.
 */
function unfold(raw: string): string {
  return raw.replace(/\r?\n[ \t]/g, '')
}

/**
 * Parse a DATE or DATE-TIME iCal value into a JS Date.
 * DATE-only values (YYYYMMDD) are treated as UTC midnight.
 */
function parseDate(value: string): Date | null {
  // Strip timezone ID suffix like TZID=America/New_York:20260610T...
  const clean = value.includes(':') ? value.split(':').pop()! : value

  // DATE-TIME: 20260610T140000Z or 20260610T140000
  const dtMatch = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/)
  if (dtMatch) {
    const [, yr, mo, dy, hh, mm, ss, utc] = dtMatch
    const iso = `${yr}-${mo}-${dy}T${hh}:${mm}:${ss}${utc ? 'Z' : ''}`
    const d = new Date(iso)
    return isNaN(d.getTime()) ? null : d
  }

  // DATE-only: 20260610
  const dateMatch = clean.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (dateMatch) {
    const [, yr, mo, dy] = dateMatch
    const d = new Date(`${yr}-${mo}-${dy}T00:00:00Z`)
    return isNaN(d.getTime()) ? null : d
  }

  return null
}

/**
 * Parse raw iCal text → array of ICalEvent.
 * Skips events that are missing UID, DTSTART, or DTEND.
 */
export function parseIcal(raw: string): ICalEvent[] {
  const text = unfold(raw)
  const events: ICalEvent[] = []

  // Split into VEVENT blocks
  const eventBlocks = text.split(/BEGIN:VEVENT/i).slice(1)

  for (const block of eventBlocks) {
    const end = block.indexOf('END:VEVENT')
    const body = end >= 0 ? block.slice(0, end) : block

    const get = (key: string): string | null => {
      // Match KEY or KEY;params: value
      const re = new RegExp(`^${key}(?:;[^:]*)?:(.+)$`, 'im')
      const m = body.match(re)
      return m ? m[1].trim() : null
    }

    const uid = get('UID')
    const dtstart = get('DTSTART')
    const dtend = get('DTEND')

    if (!uid || !dtstart || !dtend) continue

    const start = parseDate(dtstart)
    const end2 = parseDate(dtend)
    if (!start || !end2) continue

    const rawStatus = (get('STATUS') ?? 'CONFIRMED').toUpperCase()
    const status: ICalEvent['status'] =
      rawStatus === 'CANCELLED' ? 'CANCELLED'
      : rawStatus === 'TENTATIVE' ? 'TENTATIVE'
      : 'CONFIRMED'

    const summary = get('SUMMARY') ?? ''

    events.push({ uid, start, end: end2, summary, status })
  }

  return events
}
