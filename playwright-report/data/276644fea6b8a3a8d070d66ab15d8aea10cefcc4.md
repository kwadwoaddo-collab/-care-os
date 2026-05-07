# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke/clients.smoke.ts >> Create QA client via admin UI
- Location: tests/smoke/clients.smoke.ts:22:5

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/admin\/clients/
Received string:  "http://localhost:3000/admin/login?redirect=%2Fadmin%2Fclients"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    9 × unexpected value "http://localhost:3000/admin/login?redirect=%2Fadmin%2Fclients"

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
  - alert [ref=e45]
```

# Test source

```ts
  1  | /**
  2  |  * tests/smoke/clients.smoke.ts
  3  |  *
  4  |  * Smoke test: Create a client via the admin UI.
  5  |  *
  6  |  * Usage:
  7  |  *   npx playwright test tests/smoke/clients.smoke.ts
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
  22 | test('Create QA client via admin UI', async ({ page }) => {
  23 |   await loginAsQaAdmin(page)
  24 | 
  25 |   // Navigate to clients
  26 |   await page.goto(`${BASE_URL}/admin/clients`)
> 27 |   await expect(page).toHaveURL(/\/admin\/clients/)
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  28 | 
  29 |   // Find and click "New Client" or "Add Client"
  30 |   const newClientBtn = page.locator(
  31 |     'a:has-text("New Client"), a:has-text("Add Client"), button:has-text("New Client"), button:has-text("Add Client")'
  32 |   ).first()
  33 | 
  34 |   if (await newClientBtn.count() === 0) {
  35 |     test.skip(true, 'No "New Client" button found — UI may differ')
  36 |     return
  37 |   }
  38 | 
  39 |   await newClientBtn.click()
  40 | 
  41 |   // Fill in client form
  42 |   await page.fill('input[name="first_name"], #first_name', '[QA]')
  43 |   await page.fill('input[name="last_name"], #last_name', 'Smoke Test Client')
  44 |   await page.fill('input[name="email"], #email', 'qa.smoke.client@sprintscaleit.co.uk')
  45 | 
  46 |   // Submit the form
  47 |   await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Add")')
  48 | 
  49 |   // Should navigate back to clients list or show the new client
  50 |   await expect(page).toHaveURL(/\/admin\/clients/, { timeout: 10_000 })
  51 |   await expect(page.locator('text=Smoke Test Client')).toBeVisible({ timeout: 5_000 })
  52 | })
  53 | 
  54 | test('Clients list is accessible and contains QA data', async ({ page }) => {
  55 |   await loginAsQaAdmin(page)
  56 |   await page.goto(`${BASE_URL}/admin/clients`)
  57 | 
  58 |   // Page should load without error
  59 |   await expect(page).not.toHaveURL(/error/)
  60 |   await expect(page.locator('h1, h2').first()).toBeVisible()
  61 | 
  62 |   // QA clients should appear
  63 |   const qaClientsCount = await page.locator('text=[QA]').count()
  64 |   expect(qaClientsCount).toBeGreaterThan(0)
  65 | })
  66 | 
```