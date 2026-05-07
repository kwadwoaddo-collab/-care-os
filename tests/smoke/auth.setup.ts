/**
 * tests/smoke/auth.setup.ts
 *
 * Playwright setup file — runs once before the browser test projects start.
 *
 * Logs in as the QA admin and saves the resulting browser storage state
 * (cookies + localStorage) to .auth/admin.json. Browser test projects
 * (chromium, firefox, mobile-chrome) load that file as their initial
 * storageState, so each test starts already authenticated without making
 * a separate Supabase auth request.
 *
 * This avoids Supabase per-email rate limiting when multiple tests log in
 * to the same account in rapid succession.
 *
 * auth.smoke.ts is excluded from the browser test projects and runs under
 * its own project without storageState — it explicitly tests the login flow.
 */

import path from 'path'
import { test as setup } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

export const adminAuthFile = path.join(__dirname, '../../.auth/admin.json')

setup('save admin session state', async ({ page }) => {
  await loginAsAdmin(page)
  await page.context().storageState({ path: adminAuthFile })
})
