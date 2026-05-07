/**
 * lib/logger.ts
 *
 * Centralised structured logger for server-side code.
 *
 * Rules:
 * - Production: info/warn/error only. Verbose debug is suppressed.
 * - Development: all levels including debug.
 * - Stack traces are never forwarded to clients — only logged server-side.
 * - All calls accept optional structured metadata for future log aggregation.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.error('[auth] session invalid', { userId, path })
 *   logger.warn('[rateLimit] threshold hit', { ip, route })
 *   logger.info('[shift] created', { shiftId, companyId })
 *   logger.debug('[cache] miss', { key })   // dev only
 */

type Meta = Record<string, unknown>

const isDev = process.env.NODE_ENV !== 'production'

function fmt(level: string, message: string, meta?: Meta): string {
  const ts   = new Date().toISOString()
  const base = `[${ts}] ${level.toUpperCase()} ${message}`
  if (!meta || Object.keys(meta).length === 0) return base
  return `${base} ${JSON.stringify(meta)}`
}

export const logger = {
  error(message: string, meta?: Meta): void {
    console.error(fmt('error', message, meta))
  },

  warn(message: string, meta?: Meta): void {
    console.warn(fmt('warn', message, meta))
  },

  info(message: string, meta?: Meta): void {
    console.log(fmt('info', message, meta))
  },

  debug(message: string, meta?: Meta): void {
    if (isDev) console.debug(fmt('debug', message, meta))
  },
}
