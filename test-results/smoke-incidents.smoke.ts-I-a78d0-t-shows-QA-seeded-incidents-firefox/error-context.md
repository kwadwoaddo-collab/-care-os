# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke/incidents.smoke.ts >> Incidents list shows QA-seeded incidents
- Location: tests/smoke/incidents.smoke.ts:30:5

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
      - generic [ref=e23]:
        - generic [ref=e24]:
          - paragraph [ref=e25]: Care OS
          - heading "Admin Login" [level=1] [ref=e26]
        - generic [ref=e28]:
          - generic [ref=e29]:
            - generic [ref=e30]: Email address
            - textbox "Email address" [ref=e31]:
              - /placeholder: admin@example.com
          - generic [ref=e32]:
            - generic [ref=e33]: Password
            - textbox "Password" [ref=e34]:
              - /placeholder: ••••••••
          - button "Sign in" [ref=e35]
  - button "Open Next.js Dev Tools" [ref=e41] [cursor=pointer]:
    - img [ref=e42]
  - alert [ref=e46]
```

# Test source

```ts
  1  | /**
  2  |  * tests/smoke/incidents.smoke.ts
  3  |  *
  4  |  * Smoke test: Incident creation via admin UI.
  5  |  *
  6  |  * Usage:
  7  |  *   npx playwright test tests/smoke/incidents.smoke.ts
  8  |  */
  9  | 
  10 | import { test, expect, type Page } from '@playwright/test'
  11 | 
  12 | const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
  13 | 
  14 | async function loginAsQaAdmin(page: Page) {
  15 |   await page.goto(`${BASE_URL}/admin/login`)
  16 |   await page.fill('input[type="email"], #email', 'qa-admin@sprintscaleit.co.uk')
  17 |   await page.fill('input[type="password"], #password', 'ChangeMe123!')
  18 |   await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")')
  19 |   await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 })
  20 | }
  21 | 
  22 | test('Incidents list loads correctly', async ({ page }) => {
  23 |   await loginAsQaAdmin(page)
  24 |   await page.goto(`${BASE_URL}/admin/incidents`)
  25 | 
  26 |   await expect(page).not.toHaveURL(/error/)
  27 |   await expect(page.locator('h1, h2').first()).toBeVisible()
  28 | })
  29 | 
  30 | test('Incidents list shows QA-seeded incidents', async ({ page }) => {
  31 |   await loginAsQaAdmin(page)
  32 |   await page.goto(`${BASE_URL}/admin/incidents`)
  33 | 
  34 |   await page.waitForTimeout(1500)
  35 |   const qaCount = await page.locator('text=[QA]').count()
> 36 |   expect(qaCount).toBeGreaterThan(0)
     |                   ^ Error: expect(received).toBeGreaterThan(expected)
  37 | })
  38 | 
  39 | test('Create an incident via admin UI', async ({ page }) => {
  40 |   await loginAsQaAdmin(page)
  41 |   await page.goto(`${BASE_URL}/admin/incidents`)
  42 | 
  43 |   const newBtn = page.locator(
  44 |     'a:has-text("New Incident"), a:has-text("Report"), button:has-text("Report"), button:has-text("New Incident")'
  45 |   ).first()
  46 | 
  47 |   if (await newBtn.count() === 0) {
  48 |     test.skip(true, 'No "New Incident" button found — UI may differ')
  49 |     return
  50 |   }
  51 | 
  52 |   await newBtn.click()
  53 | 
  54 |   // Fill description
  55 |   const descInput = page.locator('textarea[name="description"], #description, textarea').first()
  56 |   if (await descInput.count() > 0) {
  57 |     await descInput.fill('[QA] Smoke test incident — auto-generated, safe to delete.')
  58 |   }
  59 | 
  60 |   // Select type if available
  61 |   const typeSelect = page.locator('select[name="incident_type"], #incident_type').first()
  62 |   if (await typeSelect.count() > 0) {
  63 |     await typeSelect.selectOption('fall')
  64 |   }
  65 | 
  66 |   // Select severity
  67 |   const severitySelect = page.locator('select[name="severity"], #severity').first()
  68 |   if (await severitySelect.count() > 0) {
  69 |     await severitySelect.selectOption('low')
  70 |   }
  71 | 
  72 |   // Submit
  73 |   const submitBtn = page.locator('button[type="submit"]').first()
  74 |   if (await submitBtn.count() > 0) {
  75 |     await submitBtn.click()
  76 |     await page.waitForTimeout(2000)
  77 |     await expect(page).not.toHaveURL(/error/)
  78 |   }
  79 | })
  80 | 
```