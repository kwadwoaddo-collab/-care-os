# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke/documents.smoke.ts >> Visit notes list shows QA-seeded notes
- Location: tests/smoke/documents.smoke.ts:91:5

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
  - alert [ref=e45]
```

# Test source

```ts
  1   | /**
  2   |  * tests/smoke/documents.smoke.ts
  3   |  *
  4   |  * Smoke test: Document upload and visit note submission.
  5   |  *
  6   |  * Usage:
  7   |  *   npx playwright test tests/smoke/documents.smoke.ts
  8   |  */
  9   | 
  10  | import { test, expect, type Page } from '@playwright/test'
  11  | import path from 'path'
  12  | import fs from 'fs'
  13  | import os from 'os'
  14  | 
  15  | const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
  16  | 
  17  | async function loginAsQaAdmin(page: Page) {
  18  |   await page.goto(`${BASE_URL}/admin/login`)
  19  |   await page.fill('input[type="email"], #email', 'qa-admin@sprintscaleit.co.uk')
  20  |   await page.fill('input[type="password"], #password', 'ChangeMe123!')
  21  |   await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")')
  22  |   await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 })
  23  | }
  24  | 
  25  | /** Creates a tiny temp PDF-like file for upload testing */
  26  | function createTempFile(): string {
  27  |   const tmpFile = path.join(os.tmpdir(), `qa-smoke-upload-${Date.now()}.txt`)
  28  |   fs.writeFileSync(tmpFile, '[QA] Smoke test file — safe to delete.')
  29  |   return tmpFile
  30  | }
  31  | 
  32  | test('Staff profile page loads (document upload context)', async ({ page }) => {
  33  |   await loginAsQaAdmin(page)
  34  |   await page.goto(`${BASE_URL}/admin/staff`)
  35  | 
  36  |   await expect(page).not.toHaveURL(/error/)
  37  | 
  38  |   // Navigate to first QA staff member
  39  |   const qaStaffLink = page.locator('a:has-text("[QA]"), tr:has-text("[QA]") a').first()
  40  |   if (await qaStaffLink.count() === 0) {
  41  |     test.skip(true, 'No QA staff found in staff list')
  42  |     return
  43  |   }
  44  | 
  45  |   await qaStaffLink.click()
  46  |   await expect(page).toHaveURL(/\/admin\/staff\//, { timeout: 5_000 })
  47  | })
  48  | 
  49  | test('Document upload UI is accessible on staff profile', async ({ page }) => {
  50  |   await loginAsQaAdmin(page)
  51  |   await page.goto(`${BASE_URL}/admin/staff`)
  52  | 
  53  |   const qaStaffLink = page.locator('a:has-text("[QA]"), tr:has-text("[QA]") a').first()
  54  |   if (await qaStaffLink.count() === 0) {
  55  |     test.skip(true, 'No QA staff found')
  56  |     return
  57  |   }
  58  | 
  59  |   await qaStaffLink.click()
  60  |   await page.waitForTimeout(1000)
  61  | 
  62  |   // Look for file upload input
  63  |   const fileInput = page.locator('input[type="file"]').first()
  64  |   if (await fileInput.count() === 0) {
  65  |     test.skip(true, 'No file upload input found on staff profile')
  66  |     return
  67  |   }
  68  | 
  69  |   // Upload a test file
  70  |   const tmpFile = createTempFile()
  71  |   await fileInput.setInputFiles(tmpFile)
  72  |   fs.unlinkSync(tmpFile)
  73  | 
  74  |   // Look for submit button
  75  |   const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Save"), button[type="submit"]').first()
  76  |   if (await uploadBtn.count() > 0) {
  77  |     await uploadBtn.click()
  78  |     await page.waitForTimeout(2000)
  79  |     await expect(page).not.toHaveURL(/error/)
  80  |   }
  81  | })
  82  | 
  83  | test('Visit notes list loads correctly', async ({ page }) => {
  84  |   await loginAsQaAdmin(page)
  85  |   await page.goto(`${BASE_URL}/admin/visit-notes`)
  86  | 
  87  |   await expect(page).not.toHaveURL(/error/)
  88  |   await expect(page.locator('h1, h2').first()).toBeVisible()
  89  | })
  90  | 
  91  | test('Visit notes list shows QA-seeded notes', async ({ page }) => {
  92  |   await loginAsQaAdmin(page)
  93  |   await page.goto(`${BASE_URL}/admin/visit-notes`)
  94  | 
  95  |   await page.waitForTimeout(1500)
  96  |   const qaCount = await page.locator('text=[QA]').count()
> 97  |   expect(qaCount).toBeGreaterThan(0)
      |                   ^ Error: expect(received).toBeGreaterThan(expected)
  98  | })
  99  | 
  100 | test('Submit a visit note', async ({ page }) => {
  101 |   await loginAsQaAdmin(page)
  102 |   await page.goto(`${BASE_URL}/admin/visit-notes`)
  103 | 
  104 |   // Find a draft note
  105 |   const draftNote = page.locator('text=draft, text=Draft').first()
  106 |   if (await draftNote.count() > 0) {
  107 |     await draftNote.click()
  108 |     await page.waitForTimeout(1000)
  109 | 
  110 |     // Fill in required fields if present
  111 |     const wellbeingInput = page.locator('textarea[name="wellbeing_notes"], #wellbeing_notes').first()
  112 |     if (await wellbeingInput.count() > 0) {
  113 |       await wellbeingInput.fill('[QA] Smoke test — client in good spirits during visit.')
  114 |     }
  115 | 
  116 |     const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Save")').first()
  117 |     if (await submitBtn.count() > 0) {
  118 |       await submitBtn.click()
  119 |       await page.waitForTimeout(2000)
  120 |       await expect(page).not.toHaveURL(/error/)
  121 |     }
  122 |   } else {
  123 |     // Just verify the page loads
  124 |     expect(true).toBeTruthy()
  125 |   }
  126 | })
  127 | 
```