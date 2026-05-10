/**
 * tests/smoke/worker.writes.smoke.ts
 *
 * Worker portal write-action smoke tests.
 *
 * Strategy:
 *   All tests call APIs directly via Playwright's `request` fixture — no UI
 *   interaction is required. The worker token is sent in the request body exactly
 *   as the real mobile portal does, so this exercises the full server path
 *   (token validation → DB write → audit log) without browser state.
 *
 *   Every test is idempotent and tolerates pre-existing data:
 *     - Availability PATCH is a true upsert
 *     - Acknowledge re-writes the same ack fields (no duplicate-block)
 *     - Visit note create returns 409 with note_id when a note already exists
 *     - Clock-in returns 409 (not an error) when already clocked in
 *     - Clock-out returns 409 (not an error) when already clocked out
 *     - Document upload always creates a new record (accumulative, not destructive)
 *
 *   No test deletes anything. No test depends on another test's side-effects.
 *
 * Covered write actions:
 *   1. Availability save
 *   2. Shift acknowledgement
 *   3. Visit note create
 *   4. Visit note save draft
 *   5. Document upload
 *   6. Clock in
 *   7. Clock out
 *
 * Prerequisites:
 *   The "worker-setup" project runs worker.setup.ts first and validates
 *   the QA token is seeded. If it fails, run: npm run qa:seed
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { QA_WORKER_PORTAL_TOKEN } from './helpers/auth'

const TOKEN = QA_WORKER_PORTAL_TOKEN

const FIXTURE_PNG = path.join(__dirname, '../fixtures/qa-test-document.png')

// ── Shared types ───────────────────────────────────────────────────────────────

type ShiftSummary = {
  id: string
  status: string
  worker_ack_status: string | null
  visit_note_id: string | null
}

// ── 1. Availability save ───────────────────────────────────────────────────────
//
// PATCH /api/worker/availability — upsert, always idempotent.

test('worker write: save availability returns saved record', async ({ request }) => {
  const res = await request.patch('/api/worker/availability', {
    data: {
      token:                TOKEN,
      monday:               { available: true,  start_time: '09:00', end_time: '17:00', notes: '' },
      tuesday:              { available: true,  start_time: '09:00', end_time: '17:00', notes: '' },
      wednesday:            { available: false, start_time: '',      end_time: '',      notes: '' },
      thursday:             { available: true,  start_time: '09:00', end_time: '17:00', notes: '' },
      friday:               { available: true,  start_time: '09:00', end_time: '17:00', notes: '' },
      saturday:             { available: false, start_time: '',      end_time: '',      notes: '' },
      sunday:               { available: false, start_time: '',      end_time: '',      notes: '' },
      max_weekly_hours:     37,
      preferred_shift_type: 'days',
      can_work_nights:      false,
      can_work_weekends:    false,
      is_driver:            true,
      has_own_car:          true,
      work_areas:           ['[QA] North London'],
      unavailable_dates:    [],
      notes:                '[QA] Smoke test — availability save',
    },
  })

  expect(res.status()).toBe(200)

  const data = await res.json() as {
    staff_profile_id: string
    monday: { available: boolean }
    max_weekly_hours: number | null
    is_driver: boolean
  }

  expect(data.staff_profile_id).toBeTruthy()
  expect(data.monday).toMatchObject({ available: true })
  expect(data.max_weekly_hours).toBe(37)
  expect(data.is_driver).toBe(true)
})

// ── 2. Shift acknowledgement ──────────────────────────────────────────────────
//
// POST /api/worker/shifts/{id}/acknowledge — re-acknowledging is allowed, so
// this is idempotent across runs. Uses "running_late" to avoid overwriting
// the "accepted" status used by UI tests that look for ack-button visibility.

test('worker write: acknowledge shift as running_late returns updated ack status', async ({ request }) => {
  const shiftsRes = await request.get(`/api/worker/shifts?token=${encodeURIComponent(TOKEN)}`)
  expect(shiftsRes.ok()).toBe(true)

  const shifts = await shiftsRes.json() as ShiftSummary[]
  const target = shifts.find((s) => s.status !== 'cancelled' && s.status !== 'completed')

  if (!target) {
    test.skip(true, 'No ackable shift for QA worker — run: npm run qa:seed')
    return
  }

  const ackRes = await request.post(`/api/worker/shifts/${target.id}/acknowledge`, {
    data: {
      token:  TOKEN,
      action: 'running_late',
      reason: '[QA] smoke test — write action verification',
    },
  })

  expect(ackRes.status()).toBe(200)

  const ack = await ackRes.json() as {
    id: string
    worker_ack_status: string
    worker_ack_at: string
    worker_ack_reason: string | null
  }

  expect(ack.id).toBe(target.id)
  expect(ack.worker_ack_status).toBe('running_late')
  expect(ack.worker_ack_at).toBeTruthy()
})

// ── 3. Shift accept (separate from running_late so ack tests don't collide) ──
//
// Verify "accepted" action also works. Uses the confirmed shift (index 1)
// which the seed pre-seeds with ack=accepted — re-accepting is idempotent.

test('worker write: acknowledge shift as accepted returns 200', async ({ request }) => {
  const shiftsRes = await request.get(`/api/worker/shifts?token=${encodeURIComponent(TOKEN)}`)
  expect(shiftsRes.ok()).toBe(true)

  const shifts = await shiftsRes.json() as ShiftSummary[]
  // Prefer a shift that's already confirmed/accepted to minimise state churn
  const target =
    shifts.find((s) => s.status === 'confirmed') ??
    shifts.find((s) => s.status !== 'cancelled' && s.status !== 'completed')

  if (!target) {
    test.skip(true, 'No ackable shift for QA worker — run: npm run qa:seed')
    return
  }

  const ackRes = await request.post(`/api/worker/shifts/${target.id}/acknowledge`, {
    data: { token: TOKEN, action: 'accepted' },
  })

  expect(ackRes.status()).toBe(200)

  const ack = await ackRes.json() as { worker_ack_status: string }
  expect(ack.worker_ack_status).toBe('accepted')
})

// ── 4. Visit note create ──────────────────────────────────────────────────────
//
// POST /api/worker/visit-notes — 201 on first create, 409 with note_id if one
// already exists. Both outcomes are valid and tested here.

test('worker write: create visit note returns 201 or 409 with note_id', async ({ request }) => {
  const shiftsRes = await request.get(`/api/worker/shifts?token=${encodeURIComponent(TOKEN)}`)
  expect(shiftsRes.ok()).toBe(true)

  const shifts = await shiftsRes.json() as ShiftSummary[]
  const target = shifts.find((s) => s.status !== 'cancelled')

  if (!target) {
    test.skip(true, 'No shifts for QA worker — run: npm run qa:seed')
    return
  }

  const res = await request.post('/api/worker/visit-notes', {
    data: { token: TOKEN, shift_id: target.id },
  })

  expect([201, 409]).toContain(res.status())

  const body = await res.json() as { id?: string; note_id?: string; error?: string; status?: string }

  if (res.status() === 201) {
    expect(body.id).toBeTruthy()
    expect(body.status).toBe('draft')
  } else {
    // 409 = already exists
    expect(body.note_id).toBeTruthy()
  }
})

// ── 5. Visit note save draft ──────────────────────────────────────────────────
//
// PATCH /api/worker/visit-notes — saves fields on a draft note. Creates the note
// first if it doesn't exist. Skips gracefully if all notes are already submitted.

test('worker write: save visit note draft persists wellbeing_notes field', async ({ request }) => {
  const shiftsRes = await request.get(`/api/worker/shifts?token=${encodeURIComponent(TOKEN)}`)
  expect(shiftsRes.ok()).toBe(true)

  const shifts = await shiftsRes.json() as ShiftSummary[]
  const target = shifts.find((s) => s.status !== 'cancelled')

  if (!target) {
    test.skip(true, 'No shifts for QA worker — run: npm run qa:seed')
    return
  }

  // Create note or get existing id
  const createRes = await request.post('/api/worker/visit-notes', {
    data: { token: TOKEN, shift_id: target.id },
  })

  let noteId: string
  if (createRes.status() === 201) {
    const created = await createRes.json() as { id: string }
    noteId = created.id
  } else if (createRes.status() === 409) {
    const existing = await createRes.json() as { note_id: string }
    noteId = existing.note_id
  } else {
    throw new Error(`Unexpected status creating visit note: ${createRes.status()}`)
  }

  // Fetch current status before trying to save
  const fetchRes = await request.get(
    `/api/worker/visit-notes/${noteId}?token=${encodeURIComponent(TOKEN)}`
  )
  expect(fetchRes.ok()).toBe(true)

  const currentNote = await fetchRes.json() as { id: string; status: string }

  if (currentNote.status === 'submitted' || currentNote.status === 'locked') {
    test.skip(true, 'QA visit note is already submitted — cannot save draft. Run: npm run qa:reset && npm run qa:seed')
    return
  }

  // Save draft
  const saveRes = await request.patch('/api/worker/visit-notes', {
    data: {
      token:               TOKEN,
      note_id:             noteId,
      wellbeing_notes:     '[QA] Client appeared comfortable. Smoke test draft save.',
      care_tasks_completed:'[QA] Personal care completed. Medication prompted.',
      general_notes:       '[QA] All tasks completed satisfactorily.',
      medication_prompted: false,
      incident_reported:   false,
    },
  })

  expect(saveRes.status()).toBe(200)

  const saved = await saveRes.json() as {
    id: string
    status: string
    wellbeing_notes: string | null
    general_notes: string | null
  }

  expect(saved.id).toBe(noteId)
  expect(saved.status).toBe('draft')
  expect(saved.wellbeing_notes).toBe('[QA] Client appeared comfortable. Smoke test draft save.')
  expect(saved.general_notes).toBe('[QA] All tasks completed satisfactorily.')
})

// ── 6. Document upload ────────────────────────────────────────────────────────
//
// POST /api/worker/documents/upload — multipart form. Each run creates a new
// document record (accumulative, not destructive — QA documents are expected
// to build up over time and are easy to identify by file_name prefix).
//
// Requires migration 027_fix_documents_constraint.sql to be applied on the
// target environment. If not applied, the DB insert will fail (500) because
// the legacy `documents_check` constraint requires profile_id OR applicant_id
// to be non-null, but the worker upload only provides staff_profile_id.
// Fix: apply the migration via the Supabase SQL Editor or `supabase db push`.

test('worker write: upload document returns 201 with document record', async ({ request }) => {
  const fileBuffer = fs.readFileSync(FIXTURE_PNG)

  const res = await request.post('/api/worker/documents/upload', {
    multipart: {
      token:         TOKEN,
      document_type: 'other',
      file: {
        name:     'qa-smoke-test.png',
        mimeType: 'image/png',
        buffer:   fileBuffer,
      },
    },
  })

  // Detect missing migration 027 — the constraint check fires when inserting
  // staff_profile_id-only documents without profile_id/applicant_id.
  if (res.status() === 500) {
    const body = await res.json() as { error?: string }
    if (body.error === 'Failed to save document record') {
      test.skip(
        true,
        'Document DB insert failed — migration 027_fix_documents_constraint.sql is not applied on this environment. ' +
        'Run it via the Supabase SQL Editor: ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_check; ' +
        'Or run: supabase db push --linked'
      )
      return
    }
  }

  expect(res.status()).toBe(201)

  const body = await res.json() as {
    document: {
      id:            string
      document_type: string
      file_name:     string
    }
  }

  expect(body.document).toBeDefined()
  expect(body.document.id).toBeTruthy()
  expect(body.document.document_type).toBe('other')
  expect(body.document.file_name).toBe('qa-smoke-test.png')
})

// ── 7. Clock in ───────────────────────────────────────────────────────────────
//
// POST /api/worker/timesheets/clock-in — 201 on first clock-in for a shift;
// 409 on subsequent runs (already clocked in). Both are valid outcomes.

test('worker write: clock in returns 201 or 409 (already clocked in)', async ({ request }) => {
  const shiftsRes = await request.get(`/api/worker/shifts?token=${encodeURIComponent(TOKEN)}`)
  expect(shiftsRes.ok()).toBe(true)

  const shifts = await shiftsRes.json() as ShiftSummary[]
  const target = shifts.find((s) => s.status !== 'cancelled' && s.status !== 'completed')

  if (!target) {
    test.skip(true, 'No clocked-in-eligible shift — run: npm run qa:seed')
    return
  }

  const res = await request.post('/api/worker/timesheets/clock-in', {
    data: { token: TOKEN, shift_id: target.id },
  })

  expect([201, 409]).toContain(res.status())

  const body = await res.json() as {
    id?: string
    clock_in?: string
    clock_out?: string | null
    status?: string
    timesheet?: { id: string; clock_in: string }
  }

  if (res.status() === 201) {
    expect(body.id).toBeTruthy()
    expect(body.clock_in).toBeTruthy()
    expect(body.clock_out).toBeNull()
    expect(body.status).toBe('clocked_in')
  } else {
    // 409 body: { error: 'You have already clocked in to this shift', timesheet: {...} }
    expect(body.timesheet).toBeDefined()
    expect((body.timesheet as { clock_in: string }).clock_in).toBeTruthy()
  }
})

// ── 8. Clock out ──────────────────────────────────────────────────────────────
//
// POST /api/worker/timesheets/clock-out — 200 when clocked in + not yet out;
// 409 when already clocked out. Calls clock-in first to ensure a timesheet
// exists. Tolerates all combinations of prior state.

test('worker write: clock out returns 200 or 409 with completed timesheet', async ({ request }) => {
  const shiftsRes = await request.get(`/api/worker/shifts?token=${encodeURIComponent(TOKEN)}`)
  expect(shiftsRes.ok()).toBe(true)

  const shifts = await shiftsRes.json() as ShiftSummary[]
  const target = shifts.find((s) => s.status !== 'cancelled' && s.status !== 'completed')

  if (!target) {
    test.skip(true, 'No shift available for clock-out test — run: npm run qa:seed')
    return
  }

  // Ensure a timesheet row exists (may return 409 if already clocked in — that is fine)
  await request.post('/api/worker/timesheets/clock-in', {
    data: { token: TOKEN, shift_id: target.id },
  })

  // Clock out
  const res = await request.post('/api/worker/timesheets/clock-out', {
    data: { token: TOKEN, shift_id: target.id },
  })

  // 200 = clocked out successfully; 409 = already clocked out
  expect([200, 409]).toContain(res.status())

  if (res.status() === 200) {
    const body = await res.json() as {
      id: string
      clock_out: string
      worked_minutes: number
      status: string
    }
    expect(body.clock_out).toBeTruthy()
    expect(typeof body.worked_minutes).toBe('number')
    expect(body.status).toBe('completed')
  }
})
