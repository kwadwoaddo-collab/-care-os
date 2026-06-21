const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const DATE_SHORT_FORMATTER = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })
const DATE_DISPLAY_FORMATTER = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })

export function fmt(iso: string) {
  if (!iso) return '—'
  return DATE_FORMATTER.format(new Date(iso))
}

export function fmtTs(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return DATE_SHORT_FORMATTER.format(d) + ' ' + TIME_FORMATTER.format(d)
}

export function fmtTime(t: string) {
  if (!t) return '—'
  return t.slice(0, 5)
}

export function fmtDateDisplay(iso: string) {
  if (!iso) return '—'
  return DATE_DISPLAY_FORMATTER.format(new Date(iso))
}

export function staffName(p: { first_name: string | null; last_name: string | null } | null): string {
  if (!p) return '—'
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
}

export async function settle<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise
  } catch (error) {
    console.error('Promise settled with fallback due to error:', error)
    return fallback
  }
}
