/**
 * lib/logger.ts
 *
 * Centralised structured logger for server-side code.
 *
 * Rules:
 * - Production: info/warn/error only. debug is suppressed.
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
 *   logger.audit('applicant.converted', { actor, entity, companyId })
 */

type Severity = 'debug' | 'info' | 'warn' | 'error' | 'audit'

type Meta = Record<string, unknown>

interface LogEntry {
  ts:        string
  severity:  Severity
  message:   string
  meta?:     Meta
  requestId?: string
}

const isDev = process.env.NODE_ENV !== 'production'

// Optional correlation ID injected per-request (set via AsyncLocalStorage in edge middleware
// or passed explicitly by callers that have access to request headers).
let _requestId: string | undefined

export function setRequestId(id: string) {
  _requestId = id
}

function serialize(entry: LogEntry): string {
  const { ts, severity, message, meta, requestId } = entry
  const parts = [`[${ts}]`, severity.toUpperCase(), message]
  if (requestId) parts.push(`rid=${requestId}`)
  if (meta && Object.keys(meta).length > 0) parts.push(JSON.stringify(meta))
  return parts.join(' ')
}

function log(severity: Severity, message: string, meta?: Meta): void {
  const entry: LogEntry = {
    ts:        new Date().toISOString(),
    severity,
    message,
    meta,
    requestId: _requestId,
  }

  const line = serialize(entry)

  switch (severity) {
    case 'error': console.error(line); break
    case 'warn':  console.warn(line);  break
    case 'audit': console.log(line);   break
    default:      console.log(line);   break
  }
}

export const logger = {
  error(message: string, meta?: Meta): void {
    log('error', message, meta)
  },

  warn(message: string, meta?: Meta): void {
    log('warn', message, meta)
  },

  info(message: string, meta?: Meta): void {
    log('info', message, meta)
  },

  debug(message: string, meta?: Meta): void {
    if (isDev) log('debug', message, meta)
  },

  /** Structured audit record for security-sensitive operations. */
  audit(action: string, meta: {
    actor?:    string | null
    entity?:   string
    entityId?: string
    companyId?: string
    severity?: 'low' | 'medium' | 'high' | 'critical'
    [key: string]: unknown
  }): void {
    log('audit', `[audit] ${action}`, meta)
  },
}

// ── Operation-specific log helpers ────────────────────────────────────────────

export const opLog = {
  authFailure(reason: string, meta?: Meta) {
    logger.warn(`[auth.failure] ${reason}`, meta)
  },

  rbacDenied(action: string, role: string, meta?: Meta) {
    logger.warn(`[rbac.denied] ${action}`, { role, ...meta })
  },

  inviteFailure(type: 'admin' | 'worker' | 'applicant', reason: string, meta?: Meta) {
    logger.error(`[invite.failure/${type}] ${reason}`, meta)
  },

  uploadFailure(reason: string, meta?: Meta) {
    logger.error(`[upload.failure] ${reason}`, meta)
  },

  approvalFailure(reason: string, meta?: Meta) {
    logger.error(`[approval.failure] ${reason}`, meta)
  },

  conversionFailure(reason: string, meta?: Meta) {
    logger.error(`[conversion.failure] ${reason}`, meta)
  },

  shiftAssignFailure(reason: string, meta?: Meta) {
    logger.error(`[shift.assign.failure] ${reason}`, meta)
  },
}
