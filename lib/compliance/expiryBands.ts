// lib/compliance/expiryBands.ts
//
// Multi-band expiry intelligence used across the compliance dashboard,
// reminder engine, and staff compliance rows.
//
// Bands (by days until expiry):
//   expired  — already past
//   critical — expires within 7 days
//   warning  — expires within 14 days
//   notice   — expires within 30 days
//   ok       — expires beyond 30 days, or no expiry (treat as valid)

export type ExpiryBand = 'expired' | 'critical' | 'warning' | 'notice' | 'ok'

export const BAND_DAYS = {
  critical: 7,
  warning:  14,
  notice:   30,
} as const

export function getDaysUntilExpiry(expiryDate: string): number {
  return Math.ceil(
    (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
}

/**
 * Returns which expiry band a date falls in.
 * null expiry_date → 'ok' (no expiry set — treated as perpetually valid).
 */
export function getExpiryBand(expiryDate: string | null): ExpiryBand {
  if (!expiryDate) return 'ok'
  const days = getDaysUntilExpiry(expiryDate)
  if (days <  0)                return 'expired'
  if (days <= BAND_DAYS.critical) return 'critical'
  if (days <= BAND_DAYS.warning)  return 'warning'
  if (days <= BAND_DAYS.notice)   return 'notice'
  return 'ok'
}

export function getExpiryBandLabel(band: ExpiryBand): string {
  switch (band) {
    case 'expired':  return 'Expired'
    case 'critical': return 'Expires ≤ 7 days'
    case 'warning':  return 'Expires ≤ 14 days'
    case 'notice':   return 'Expires ≤ 30 days'
    case 'ok':       return 'Valid'
  }
}

/** Tailwind CSS classes for each band — used in table cells and badges. */
export const BAND_CLS: Record<ExpiryBand, string> = {
  expired:  'bg-red-50    text-red-700    ring-red-600/20',
  critical: 'bg-red-50    text-red-700    ring-red-600/20',
  warning:  'bg-orange-50 text-orange-700 ring-orange-600/20',
  notice:   'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  ok:       'bg-green-50  text-green-700  ring-green-600/20',
}

/** Returns the most urgent band across a list of dates */
export function worstBand(dates: (string | null)[]): ExpiryBand {
  const order: ExpiryBand[] = ['expired', 'critical', 'warning', 'notice', 'ok']
  const bands = dates.map(getExpiryBand)
  for (const b of order) {
    if (bands.includes(b)) return b
  }
  return 'ok'
}
