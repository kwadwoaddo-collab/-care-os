# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke/incidents.smoke.ts >> Incidents list shows QA-seeded incidents
- Location: tests/smoke/incidents.smoke.ts:23:5

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
            - heading "Incidents" [level=1] [ref=e25]
            - paragraph [ref=e26]: 0 incidents
          - button "+ Create Incident" [ref=e27]
        - generic [ref=e28]:
          - generic [ref=e29]:
            - paragraph [ref=e30]: Open
            - paragraph [ref=e31]: "0"
          - generic [ref=e32]:
            - paragraph [ref=e33]: High / Critical
            - paragraph [ref=e34]: "0"
          - generic [ref=e35]:
            - paragraph [ref=e36]: Investigating
            - paragraph [ref=e37]: "0"
          - generic [ref=e38]:
            - paragraph [ref=e39]: Resolved this month
            - paragraph [ref=e40]: "0"
        - generic [ref=e41]:
          - textbox "Search description…" [ref=e42]
          - combobox [ref=e43]:
            - 'option "Status: All" [selected]'
            - option "Open"
            - option "Investigating"
            - option "Resolved"
            - option "Closed"
          - combobox [ref=e44]:
            - 'option "Severity: All" [selected]'
            - option "Low"
            - option "Medium"
            - option "High"
            - option "Critical"
          - combobox [ref=e45]:
            - 'option "Type: All" [selected]'
            - option "Fall"
            - option "Medication error"
            - option "Safeguarding"
            - option "Injury"
            - option "Behaviour"
            - option "Missed visit"
            - option "Property damage"
            - option "Complaint"
            - option "Other"
          - button "Search" [ref=e46]
        - generic [ref=e47]:
          - img [ref=e49]
          - paragraph [ref=e51]: No incidents recorded yet
          - paragraph [ref=e52]: Incidents are created automatically when a carer flags an issue on a visit note, or log one manually using the button above.
  - button "Open Next.js Dev Tools" [ref=e58] [cursor=pointer]:
    - img [ref=e59]
  - alert [ref=e62]
```

# Test source

```ts
  1  | /**
  2  |  * tests/smoke/incidents.smoke.ts
  3  |  *
  4  |  * Smoke test: Incident list and creation via admin UI.
  5  |  *
  6  |  * Auth: loaded from storageState (see playwright.config.ts).
  7  |  * Each test gets an isolated browser context pre-seeded with the QA admin
  8  |  * session — no per-test Supabase login needed.
  9  |  *
  10 |  * Usage:
  11 |  *   npx playwright test tests/smoke/incidents.smoke.ts
  12 |  */
  13 | 
  14 | import { test, expect } from '@playwright/test'
  15 | import { expectAdminPage } from './helpers/auth'
  16 | 
  17 | test('Incidents list loads correctly', async ({ page }) => {
  18 |   await expectAdminPage(page, '/admin/incidents')
  19 | 
  20 |   await expect(page.locator('h1, h2').first()).toBeVisible()
  21 | })
  22 | 
  23 | test('Incidents list shows QA-seeded incidents', async ({ page }) => {
  24 |   await expectAdminPage(page, '/admin/incidents')
  25 | 
  26 |   await page.waitForTimeout(1_500)
  27 |   const qaCount = await page.locator('text=[QA]').count()
> 28 |   expect(qaCount).toBeGreaterThan(0)
     |                   ^ Error: expect(received).toBeGreaterThan(expected)
  29 | })
  30 | 
  31 | test('Create an incident via admin UI', async ({ page }) => {
  32 |   await expectAdminPage(page, '/admin/incidents')
  33 | 
  34 |   const newBtn = page.locator(
  35 |     'a:has-text("New Incident"), a:has-text("Report"), button:has-text("Report"), button:has-text("New Incident")'
  36 |   ).first()
  37 | 
  38 |   if (await newBtn.count() === 0) {
  39 |     test.skip(true, 'No "New Incident" button found — UI may differ')
  40 |     return
  41 |   }
  42 | 
  43 |   await newBtn.click()
  44 | 
  45 |   const descInput = page.locator('textarea[name="description"], #description, textarea').first()
  46 |   if (await descInput.count() > 0) {
  47 |     await descInput.fill('[QA] Smoke test incident — auto-generated, safe to delete.')
  48 |   }
  49 | 
  50 |   const typeSelect = page.locator('select[name="incident_type"], #incident_type').first()
  51 |   if (await typeSelect.count() > 0) {
  52 |     await typeSelect.selectOption('fall')
  53 |   }
  54 | 
  55 |   const severitySelect = page.locator('select[name="severity"], #severity').first()
  56 |   if (await severitySelect.count() > 0) {
  57 |     await severitySelect.selectOption('low')
  58 |   }
  59 | 
  60 |   const submitBtn = page.locator('button[type="submit"]').first()
  61 |   if (await submitBtn.count() > 0) {
  62 |     await submitBtn.click()
  63 |     await page.waitForTimeout(2_000)
  64 |     await expect(page).not.toHaveURL(/error/)
  65 |   }
  66 | })
  67 | 
```