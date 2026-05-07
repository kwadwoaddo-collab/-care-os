# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke/documents.smoke.ts >> Visit notes list shows QA-seeded notes
- Location: tests/smoke/documents.smoke.ts:84:5

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
          - heading "Visit Notes" [level=1] [ref=e24]
          - paragraph [ref=e25]: 0 notes
        - generic [ref=e26]:
          - generic [ref=e27]:
            - paragraph [ref=e28]: Total
            - paragraph [ref=e29]: "0"
          - generic [ref=e30]:
            - paragraph [ref=e31]: Draft
            - paragraph [ref=e32]: "0"
          - generic [ref=e33]:
            - paragraph [ref=e34]: Submitted
            - paragraph [ref=e35]: "0"
          - generic [ref=e36]:
            - paragraph [ref=e37]: Incidents
            - paragraph [ref=e38]: "0"
        - generic [ref=e39]: No visit notes yet. Create one from the Shifts page.
  - button "Open Next.js Dev Tools" [ref=e45] [cursor=pointer]:
    - img [ref=e46]
  - alert [ref=e49]
```

# Test source

```ts
  1   | /**
  2   |  * tests/smoke/documents.smoke.ts
  3   |  *
  4   |  * Smoke test: Document upload and visit note submission.
  5   |  *
  6   |  * Auth: loaded from storageState (see playwright.config.ts).
  7   |  * Each test gets an isolated browser context pre-seeded with the QA admin
  8   |  * session — no per-test Supabase login needed.
  9   |  *
  10  |  * Usage:
  11  |  *   npx playwright test tests/smoke/documents.smoke.ts
  12  |  */
  13  | 
  14  | import { test, expect } from '@playwright/test'
  15  | import path from 'path'
  16  | import fs from 'fs'
  17  | import os from 'os'
  18  | import { expectAdminPage } from './helpers/auth'
  19  | 
  20  | /** Creates a tiny temp file for upload testing */
  21  | function createTempFile(): string {
  22  |   const tmpFile = path.join(os.tmpdir(), `qa-smoke-upload-${Date.now()}.txt`)
  23  |   fs.writeFileSync(tmpFile, '[QA] Smoke test file — safe to delete.')
  24  |   return tmpFile
  25  | }
  26  | 
  27  | test('Staff list loads and shows QA staff', async ({ page }) => {
  28  |   await expectAdminPage(page, '/admin/staff')
  29  | 
  30  |   await expect(page.locator('h1, h2').first()).toBeVisible()
  31  | })
  32  | 
  33  | test('Staff profile page loads (document upload context)', async ({ page }) => {
  34  |   await expectAdminPage(page, '/admin/staff')
  35  | 
  36  |   const qaStaffLink = page.locator('a:has-text("[QA]"), tr:has-text("[QA]") a').first()
  37  |   if (await qaStaffLink.count() === 0) {
  38  |     test.skip(true, 'No QA staff found in staff list — run npx tsx scripts/seed-qa-environment.ts first')
  39  |     return
  40  |   }
  41  | 
  42  |   await qaStaffLink.click()
  43  |   await expect(page).toHaveURL(/\/admin\/staff\//, { timeout: 5_000 })
  44  |   await expect(page).not.toHaveURL(/\/admin\/login/)
  45  | })
  46  | 
  47  | test('Document upload UI is accessible on staff profile', async ({ page }) => {
  48  |   await expectAdminPage(page, '/admin/staff')
  49  | 
  50  |   const qaStaffLink = page.locator('a:has-text("[QA]"), tr:has-text("[QA]") a').first()
  51  |   if (await qaStaffLink.count() === 0) {
  52  |     test.skip(true, 'No QA staff found — run npx tsx scripts/seed-qa-environment.ts first')
  53  |     return
  54  |   }
  55  | 
  56  |   await qaStaffLink.click()
  57  |   await expect(page).not.toHaveURL(/\/admin\/login/)
  58  |   await page.waitForTimeout(1_000)
  59  | 
  60  |   const fileInput = page.locator('input[type="file"]').first()
  61  |   if (await fileInput.count() === 0) {
  62  |     test.skip(true, 'No file upload input found on staff profile')
  63  |     return
  64  |   }
  65  | 
  66  |   const tmpFile = createTempFile()
  67  |   await fileInput.setInputFiles(tmpFile)
  68  |   fs.unlinkSync(tmpFile)
  69  | 
  70  |   const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Save"), button[type="submit"]').first()
  71  |   if (await uploadBtn.count() > 0) {
  72  |     await uploadBtn.click()
  73  |     await page.waitForTimeout(2_000)
  74  |     await expect(page).not.toHaveURL(/error/)
  75  |   }
  76  | })
  77  | 
  78  | test('Visit notes list loads correctly', async ({ page }) => {
  79  |   await expectAdminPage(page, '/admin/visit-notes')
  80  | 
  81  |   await expect(page.locator('h1, h2').first()).toBeVisible()
  82  | })
  83  | 
  84  | test('Visit notes list shows QA-seeded notes', async ({ page }) => {
  85  |   await expectAdminPage(page, '/admin/visit-notes')
  86  | 
  87  |   await page.waitForTimeout(1_500)
  88  |   const qaCount = await page.locator('text=[QA]').count()
> 89  |   expect(qaCount).toBeGreaterThan(0)
      |                   ^ Error: expect(received).toBeGreaterThan(expected)
  90  | })
  91  | 
  92  | test('Submit a visit note', async ({ page }) => {
  93  |   await expectAdminPage(page, '/admin/visit-notes')
  94  | 
  95  |   const draftNote = page.locator('text=draft, text=Draft').first()
  96  |   if (await draftNote.count() > 0) {
  97  |     await draftNote.click()
  98  |     await expect(page).not.toHaveURL(/\/admin\/login/)
  99  |     await page.waitForTimeout(1_000)
  100 | 
  101 |     const wellbeingInput = page.locator('textarea[name="wellbeing_notes"], #wellbeing_notes').first()
  102 |     if (await wellbeingInput.count() > 0) {
  103 |       await wellbeingInput.fill('[QA] Smoke test — client in good spirits during visit.')
  104 |     }
  105 | 
  106 |     const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Save")').first()
  107 |     if (await submitBtn.count() > 0) {
  108 |       await submitBtn.click()
  109 |       await page.waitForTimeout(2_000)
  110 |       await expect(page).not.toHaveURL(/error/)
  111 |     }
  112 |   } else {
  113 |     expect(true).toBeTruthy()
  114 |   }
  115 | })
  116 | 
```