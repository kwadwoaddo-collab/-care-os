# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke/clients.smoke.ts >> Clients list is accessible and contains QA data
- Location: tests/smoke/clients.smoke.ts:17:5

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]: Care OS — Admin
        - navigation [ref=e6]:
          - link "Applicants" [ref=e7] [cursor=pointer]:
            - /url: /admin/applicants
          - link "Staff" [ref=e8] [cursor=pointer]:
            - /url: /admin/staff
          - link "Onboarding" [ref=e9] [cursor=pointer]:
            - /url: /admin/onboarding
          - link "Compliance" [ref=e10] [cursor=pointer]:
            - /url: /admin/compliance
          - link "Audit Log" [ref=e11] [cursor=pointer]:
            - /url: /admin/audit-log
          - link "Notifications" [ref=e12] [cursor=pointer]:
            - /url: /admin/notifications
          - link "Clients" [ref=e13] [cursor=pointer]:
            - /url: /admin/clients
          - link "Care Packages" [ref=e14] [cursor=pointer]:
            - /url: /admin/care-packages
          - link "Shifts" [ref=e15] [cursor=pointer]:
            - /url: /admin/shifts
          - link "Shift Ops" [ref=e16] [cursor=pointer]:
            - /url: /admin/shifts/operations
          - link "Visit Notes" [ref=e17] [cursor=pointer]:
            - /url: /admin/visit-notes
          - link "Incidents" [ref=e18] [cursor=pointer]:
            - /url: /admin/incidents
          - link "System" [ref=e19] [cursor=pointer]:
            - /url: /admin/system
        - link "Logout" [ref=e20] [cursor=pointer]:
          - /url: /admin/logout
    - main [ref=e21]:
      - generic [ref=e22]:
        - generic [ref=e23]:
          - generic [ref=e24]:
            - heading "Clients" [level=1] [ref=e25]
            - paragraph [ref=e26]: 0 clients
          - button "+ Create Client" [ref=e27]
        - generic [ref=e28]:
          - generic [ref=e29]:
            - paragraph [ref=e30]: Total
            - paragraph [ref=e31]: "0"
          - generic [ref=e32]:
            - paragraph [ref=e33]: Active
            - paragraph [ref=e34]: "0"
          - generic [ref=e35]:
            - paragraph [ref=e36]: Paused
            - paragraph [ref=e37]: "0"
          - generic [ref=e38]:
            - paragraph [ref=e39]: High / critical risk
            - paragraph [ref=e40]: "0"
        - generic [ref=e41]:
          - textbox "Search name, postcode, phone…" [ref=e42]
          - combobox [ref=e43]:
            - 'option "Status: All" [selected]'
            - option "Active"
            - option "Prospective"
            - option "Paused"
            - option "Ended"
          - combobox [ref=e44]:
            - 'option "Risk level: All" [selected]'
            - option "Low"
            - option "Standard"
            - option "High"
            - option "Critical"
          - combobox [ref=e45]:
            - 'option "Funding type: All" [selected]'
            - option "Private"
            - option "Local authority"
            - option "NHS"
            - option "Direct payment"
            - option "Other"
          - button "Search" [ref=e46]
        - generic [ref=e47]:
          - img [ref=e49]
          - paragraph [ref=e51]: No clients yet
          - paragraph [ref=e52]: Add your first client using the + New Client button above.
  - button "Open Next.js Dev Tools" [ref=e58] [cursor=pointer]:
    - img [ref=e59]
  - alert [ref=e62]
```

# Test source

```ts
  1  | /**
  2  |  * tests/smoke/clients.smoke.ts
  3  |  *
  4  |  * Smoke test: Client list and creation via admin UI.
  5  |  *
  6  |  * Auth: loaded from storageState (see playwright.config.ts).
  7  |  * Each test gets an isolated browser context pre-seeded with the QA admin
  8  |  * session — no per-test Supabase login needed.
  9  |  *
  10 |  * Usage:
  11 |  *   npx playwright test tests/smoke/clients.smoke.ts
  12 |  */
  13 | 
  14 | import { test, expect } from '@playwright/test'
  15 | import { expectAdminPage } from './helpers/auth'
  16 | 
  17 | test('Clients list is accessible and contains QA data', async ({ page }) => {
  18 |   await expectAdminPage(page, '/admin/clients')
  19 | 
  20 |   await expect(page.locator('h1, h2').first()).toBeVisible()
  21 | 
  22 |   const qaClientsCount = await page.locator('text=[QA]').count()
> 23 |   expect(qaClientsCount).toBeGreaterThan(0)
     |                          ^ Error: expect(received).toBeGreaterThan(expected)
  24 | })
  25 | 
  26 | test('Create QA client via admin UI', async ({ page }) => {
  27 |   await expectAdminPage(page, '/admin/clients')
  28 | 
  29 |   const newClientBtn = page.locator(
  30 |     'a:has-text("New Client"), a:has-text("Add Client"), button:has-text("New Client"), button:has-text("Add Client")'
  31 |   ).first()
  32 | 
  33 |   if (await newClientBtn.count() === 0) {
  34 |     test.skip(true, 'No "New Client" button found — UI may differ')
  35 |     return
  36 |   }
  37 | 
  38 |   await newClientBtn.click()
  39 | 
  40 |   await page.fill('input[name="first_name"], #first_name', '[QA]')
  41 |   await page.fill('input[name="last_name"], #last_name', 'Smoke Test Client')
  42 |   await page.fill('input[name="email"], #email', 'qa.smoke.client@sprintscaleit.co.uk')
  43 | 
  44 |   await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Add")')
  45 | 
  46 |   await expect(page).toHaveURL(/\/admin\/clients/, { timeout: 10_000 })
  47 |   await expect(page.locator('text=Smoke Test Client')).toBeVisible({ timeout: 5_000 })
  48 | })
  49 | 
```