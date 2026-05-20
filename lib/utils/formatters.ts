export function fmt(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtTs(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}

export function fmtTime(t: string) {
  if (!t) return '—'
  return t.slice(0, 5)
}

export function fmtDateDisplay(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
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
