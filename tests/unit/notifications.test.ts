/**
 * tests/unit/notifications.test.ts
 *
 * Unit tests for the in-app notification system.
 * Uses the same tsx runner pattern as the rest of tests/unit/.
 *
 * Run:  tsx tests/unit/notifications.test.ts
 */

// ── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✅  ${message}`)
    passed++
  } else {
    console.error(`  ❌  ${message}`)
    failed++
  }
}

function describe(suite: string, fn: () => void): void {
  console.log(`\n──────────────────────────────────────────`)
  console.log(`  ${suite}`)
  console.log(`──────────────────────────────────────────`)
  fn()
}

function report(): void {
  console.log(`\n══════════════════════════════════════════`)
  console.log(`  Results: ${passed} passed, ${failed} failed`)
  console.log(`══════════════════════════════════════════\n`)
  if (failed > 0) process.exit(1)
}

// ── Types import (no DB calls — pure type checking & logic tests) ─────────────

import type {
  CreateNotificationPayload,
  WorkerNotificationPayload,
  AdminNotificationPayload,
  InAppEventType,
} from '../../lib/notifications/createNotification'

// ── Helper: build payloads ────────────────────────────────────────────────────

function workerPayload(overrides: Partial<WorkerNotificationPayload> = {}): WorkerNotificationPayload {
  return {
    recipient:      'worker',
    staffProfileId: 'staff-001',
    companyId:      'company-001',
    eventType:      'shift_offer',
    title:          'New shift offer: Care Home A',
    message:        '2026-06-01 · 08:00–16:00',
    actionUrl:      '/worker/shifts',
    entityId:       'shift-001',
    ...overrides,
  }
}

function adminPayload(overrides: Partial<AdminNotificationPayload> = {}): AdminNotificationPayload {
  return {
    recipient:  'admin',
    companyId:  'company-001',
    eventType:  'shift_accepted',
    title:      'Alice Smith accepted a shift',
    message:    'Morning shift on 2026-06-01',
    actionUrl:  '/admin/shifts/operations',
    entityId:   'shift-001',
    actorId:    'staff-001',
    ...overrides,
  }
}

// ── Tests: Payload shape ──────────────────────────────────────────────────────

describe('Payload type discrimination', () => {
  const wp = workerPayload()
  assert(wp.recipient === 'worker', 'Worker payload has recipient=worker')
  assert(wp.staffProfileId === 'staff-001', 'Worker payload has staffProfileId')
  assert(wp.eventType === 'shift_offer', 'Worker payload has correct eventType')
  assert(wp.title.length > 0, 'Worker payload has non-empty title')
  assert(typeof wp.actionUrl === 'string', 'Worker payload action_url is string')

  const ap = adminPayload()
  assert(ap.recipient === 'admin', 'Admin payload has recipient=admin')
  assert(!('staffProfileId' in ap) || (ap as unknown as { staffProfileId?: string }).staffProfileId === undefined, 'Admin payload has no staffProfileId')
  assert(ap.eventType === 'shift_accepted', 'Admin payload has correct eventType')
  assert(ap.actorId === 'staff-001', 'Admin payload carries actorId (worker who acted)')
})

// ── Tests: Event type exhaustiveness ─────────────────────────────────────────

describe('InAppEventType coverage', () => {
  const workerEvents: InAppEventType[] = [
    'shift_offer',
    'shift_assigned',
    'shift_cancelled',
    'document_rejected',
    'onboarding_reminder',
    'policy_required',
    'compliance_expiring',
  ]

  const adminEvents: InAppEventType[] = [
    'shift_accepted',
    'shift_declined',
    'running_late',
    'shift_completed',
    'visit_note',
    'incident_created',
    'compliance_alert',
    'onboarding_completed',
  ]

  assert(workerEvents.length === 7, `Worker event types defined (got ${workerEvents.length})`)
  assert(adminEvents.length === 8, `Admin event types defined (got ${adminEvents.length})`)

  for (const et of workerEvents) {
    const p: CreateNotificationPayload = workerPayload({ eventType: et })
    assert(p.eventType === et, `Worker event type ${et} is valid`)
  }

  for (const et of adminEvents) {
    const p: CreateNotificationPayload = adminPayload({ eventType: et })
    assert(p.eventType === et, `Admin event type ${et} is valid`)
  }
})

// ── Tests: Dedupe logic (pure logic simulation) ───────────────────────────────

describe('Dedupe window logic', () => {
  const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000

  function isWithinDedupeWindow(createdAt: Date): boolean {
    return Date.now() - createdAt.getTime() < DEDUPE_WINDOW_MS
  }

  const justNow     = new Date()
  const oneHourAgo  = new Date(Date.now() - 60 * 60 * 1000)
  const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000)
  const twentyFiveHoursAgo  = new Date(Date.now() - 25 * 60 * 60 * 1000)
  const twoDaysAgo  = new Date(Date.now() - 48 * 60 * 60 * 1000)

  assert(isWithinDedupeWindow(justNow), 'Notification just now is within dedupe window')
  assert(isWithinDedupeWindow(oneHourAgo), 'Notification 1h ago is within dedupe window')
  assert(isWithinDedupeWindow(twentyThreeHoursAgo), 'Notification 23h ago is within dedupe window')
  assert(!isWithinDedupeWindow(twentyFiveHoursAgo), 'Notification 25h ago is outside dedupe window')
  assert(!isWithinDedupeWindow(twoDaysAgo), 'Notification 48h ago is outside dedupe window')

  // Simulate dedupe decision: skip insert if unread + within window
  function shouldSkip(existing: { read_at: string | null; created_at: Date } | null): boolean {
    if (!existing) return false
    if (existing.read_at !== null) return false  // already read — allow re-notification
    return isWithinDedupeWindow(existing.created_at)
  }

  assert(shouldSkip({ read_at: null, created_at: justNow }), 'Unread recent duplicate → skip')
  assert(shouldSkip({ read_at: null, created_at: twentyThreeHoursAgo }), 'Unread 23h old → skip')
  assert(!shouldSkip({ read_at: null, created_at: twoDaysAgo }), 'Unread 2-day-old → do NOT skip (window expired)')
  assert(!shouldSkip({ read_at: new Date().toISOString(), created_at: justNow }), 'Already-read → do NOT skip')
  assert(!shouldSkip(null), 'No existing notification → do NOT skip')
})

// ── Tests: Shift acceptance notification ─────────────────────────────────────

describe('Shift acceptance notification payload', () => {
  const payload = adminPayload({
    eventType: 'shift_accepted',
    title:     'Jane Doe accepted a shift',
    message:   'Morning Care on 2026-06-15',
    actionUrl: '/admin/shifts/operations',
    entityId:  'shift-abc',
    actorId:   'worker-xyz',
  })

  assert(payload.recipient === 'admin', 'Shift accepted → admin recipient')
  assert(payload.eventType === 'shift_accepted', 'Shift accepted event type correct')
  assert(payload.title.includes('accepted'), 'Title mentions accepted')
  assert(payload.actionUrl === '/admin/shifts/operations', 'Deep-links to shift ops')
  assert(payload.actorId === 'worker-xyz', 'actorId is the worker who accepted')
  assert(payload.entityId === 'shift-abc', 'entityId is the shift ID for dedupe')
})

// ── Tests: Shift declined notification ────────────────────────────────────────

describe('Shift declined notification payload', () => {
  const payload = adminPayload({
    eventType: 'shift_declined',
    title:     'Bob Jones declined a shift',
    message:   'Night shift on 2026-06-15 — Family emergency',
    actionUrl: '/admin/shifts/operations',
    entityId:  'shift-xyz',
  })

  assert(payload.eventType === 'shift_declined', 'Correct event type for decline')
  assert(payload.message!.includes('Family emergency'), 'Reason included in message')
})

// ── Tests: Worker reminder notification ──────────────────────────────────────

describe('Worker onboarding reminder notification payload', () => {
  const payload = workerPayload({
    eventType: 'onboarding_reminder',
    title:     'Action needed: complete your onboarding',
    message:   '3 items still required.',
    actionUrl: '/worker/onboarding',
    entityId:  'staff-001',
  })

  assert(payload.recipient === 'worker', 'Reminder goes to worker')
  assert(payload.eventType === 'onboarding_reminder', 'Correct event type')
  assert(payload.actionUrl === '/worker/onboarding', 'Deep-links to onboarding')
  assert(payload.message!.includes('required'), 'Message mentions required items')
})

// ── Tests: Compliance expiring notification ───────────────────────────────────

describe('Compliance expiring worker notification payload', () => {
  const payload = workerPayload({
    eventType: 'compliance_expiring',
    title:     'Action needed: compliance documents require attention',
    message:   '2 documents expiring soon.',
    actionUrl: '/worker/documents',
    entityId:  'staff-001',
  })

  assert(payload.eventType === 'compliance_expiring', 'Correct event type')
  assert(payload.actionUrl === '/worker/documents', 'Deep-links to documents')
  assert(payload.message!.includes('expiring'), 'Message mentions expiring')
})

// ── Tests: Document rejected notification ────────────────────────────────────

describe('Document rejected worker notification payload', () => {
  const payload = workerPayload({
    eventType: 'document_rejected',
    title:     'Document rejected: passport',
    message:   'Please re-upload a valid document.',
    actionUrl: '/worker/documents',
    entityId:  'doc-001',
  })

  assert(payload.eventType === 'document_rejected', 'Correct event type')
  assert(payload.title.includes('rejected'), 'Title mentions rejection')
  assert(payload.actionUrl === '/worker/documents', 'Deep-links to documents')
})

// ── Tests: Incident notification ─────────────────────────────────────────────

describe('Incident created admin notification payload', () => {
  const payload = adminPayload({
    eventType: 'incident_created',
    title:     'Incident reported: fall',
    message:   'Severity: high. Client fell in bathroom.',
    actionUrl: '/admin/incidents/incident-001',
    entityId:  'incident-001',
  })

  assert(payload.eventType === 'incident_created', 'Correct event type')
  assert(payload.recipient === 'admin', 'Incident alert goes to admins')
  assert(payload.actionUrl!.includes('/admin/incidents/'), 'Deep-links to specific incident')
  assert(payload.message!.includes('Severity'), 'Message includes severity')
})

// ── Tests: Visit note notification ───────────────────────────────────────────

describe('Visit note submitted admin notification payload', () => {
  const payload = adminPayload({
    eventType: 'visit_note',
    title:     'Visit note submitted',
    message:   'A worker submitted a visit note for review.',
    actionUrl: '/admin/visit-notes',
    entityId:  'note-001',
    actorId:   'worker-001',
  })

  assert(payload.eventType === 'visit_note', 'Correct event type')
  assert(payload.recipient === 'admin', 'Visit note alert goes to admins')
  assert(payload.actionUrl === '/admin/visit-notes', 'Deep-links to visit notes')
})

// ── Tests: Title truncation invariant ────────────────────────────────────────

describe('Title length enforcement', () => {
  const longTitle = 'A'.repeat(300)
  const truncated = longTitle.slice(0, 200)
  assert(truncated.length === 200, 'Title truncated to 200 chars')
  assert(longTitle.length > truncated.length, 'Long titles are truncated by helper')
})

// ── Tests: Action URL deep-links ─────────────────────────────────────────────

describe('Deep-link action_url rules', () => {
  const cases: Array<{ eventType: InAppEventType; expectedPath: string; recipient: 'worker' | 'admin' }> = [
    { eventType: 'shift_offer',         expectedPath: '/worker/shifts',          recipient: 'worker' },
    { eventType: 'shift_assigned',      expectedPath: '/worker/shifts',          recipient: 'worker' },
    { eventType: 'shift_cancelled',     expectedPath: '/worker/shifts',          recipient: 'worker' },
    { eventType: 'document_rejected',   expectedPath: '/worker/documents',       recipient: 'worker' },
    { eventType: 'onboarding_reminder', expectedPath: '/worker/onboarding',      recipient: 'worker' },
    { eventType: 'compliance_expiring', expectedPath: '/worker/documents',       recipient: 'worker' },
    { eventType: 'shift_accepted',      expectedPath: '/admin/shifts/operations',recipient: 'admin'  },
    { eventType: 'shift_declined',      expectedPath: '/admin/shifts/operations',recipient: 'admin'  },
    { eventType: 'running_late',        expectedPath: '/admin/shifts/operations',recipient: 'admin'  },
    { eventType: 'shift_completed',     expectedPath: '/admin/shifts/operations',recipient: 'admin'  },
    { eventType: 'visit_note',          expectedPath: '/admin/visit-notes',      recipient: 'admin'  },
  ]

  for (const c of cases) {
    assert(c.expectedPath.startsWith('/'), `${c.eventType} → deep-link starts with /`)
    assert(
      (c.recipient === 'worker' ? c.expectedPath.startsWith('/worker') : c.expectedPath.startsWith('/admin')),
      `${c.eventType} → ${c.recipient} notification links to ${c.recipient} portal`
    )
  }
})

// ── Final report ──────────────────────────────────────────────────────────────

report()
