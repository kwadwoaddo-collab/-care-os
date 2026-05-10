/**
 * tests/smoke/worker.setup.ts
 *
 * Validates that the QA worker portal token is registered in the staging DB.
 * Runs in the "worker-setup" project before "worker" and "worker-mobile" tests.
 *
 * If this fails, run: npm run qa:seed
 *
 * This is a fast API-only check (no browser). It fails with a clear message
 * rather than letting every worker test fail with a confusing "Session expired"
 * error.
 */

import { test as setup, expect } from '@playwright/test'
import { QA_WORKER_PORTAL_TOKEN } from './helpers/auth'

setup('qa worker portal token is seeded', async ({ request }) => {
  const res = await request.get(
    `/api/worker/validate?token=${encodeURIComponent(QA_WORKER_PORTAL_TOKEN)}`,
  )

  const body = await res.json() as { id?: string; first_name?: string; error?: string }

  expect(
    res.status(),
    [
      `QA worker portal token not found in DB (HTTP ${res.status()}).`,
      `Error: ${body.error ?? 'unknown'}`,
      'Fix: run  npm run qa:seed  against the target environment.',
    ].join(' '),
  ).toBe(200)

  expect(body.id, 'Worker profile ID missing from validate response').toBeTruthy()
})
