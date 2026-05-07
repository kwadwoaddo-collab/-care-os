# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke/shifts.smoke.ts >> Shifts list shows QA-seeded shifts
- Location: tests/smoke/shifts.smoke.ts:30:5

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
  2   |  * tests/smoke/shifts.smoke.ts
  3   |  *
  4   |  * Smoke tests: Shift creation and worker assignment.
  5   |  *
  6   |  * Usage:
  7   |  *   npx playwright test tests/smoke/shifts.smoke.ts
  8   |  */
  9   | 
  10  | import { test, expect, type Page } from '@playwright/test'
  11  | 
  12  | const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
  13  | 
  14  | async function loginAsQaAdmin(page: Page) {
  15  |   await page.goto(`${BASE_URL}/admin/login`)
  16  |   await page.fill('input[type="email"], #email', 'qa-admin@sprintscaleit.co.uk')
  17  |   await page.fill('input[type="password"], #password', 'ChangeMe123!')
  18  |   await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")')
  19  |   await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 })
  20  | }
  21  | 
  22  | test('Shifts list is accessible and renders', async ({ page }) => {
  23  |   await loginAsQaAdmin(page)
  24  |   await page.goto(`${BASE_URL}/admin/shifts`)
  25  | 
  26  |   await expect(page).not.toHaveURL(/error/)
  27  |   await expect(page.locator('h1, h2').first()).toBeVisible()
  28  | })
  29  | 
  30  | test('Shifts list shows QA-seeded shifts', async ({ page }) => {
  31  |   await loginAsQaAdmin(page)
  32  |   await page.goto(`${BASE_URL}/admin/shifts`)
  33  | 
  34  |   // Should see QA shifts
  35  |   await page.waitForTimeout(1500)
  36  |   const qaShiftCount = await page.locator('text=[QA]').count()
> 37  |   expect(qaShiftCount).toBeGreaterThan(0)
      |                        ^ Error: expect(received).toBeGreaterThan(expected)
  38  | })
  39  | 
  40  | test('Create a shift via admin UI', async ({ page }) => {
  41  |   await loginAsQaAdmin(page)
  42  |   await page.goto(`${BASE_URL}/admin/shifts`)
  43  | 
  44  |   const newShiftBtn = page.locator(
  45  |     'a:has-text("New Shift"), a:has-text("Add Shift"), button:has-text("New Shift"), button:has-text("Add Shift"), a:has-text("Create Shift")'
  46  |   ).first()
  47  | 
  48  |   if (await newShiftBtn.count() === 0) {
  49  |     test.skip(true, 'No "New Shift" button found — UI may differ')
  50  |     return
  51  |   }
  52  | 
  53  |   await newShiftBtn.click()
  54  | 
  55  |   // Fill shift form fields if available
  56  |   const titleInput = page.locator('input[name="title"], #title, input[placeholder*="title" i]').first()
  57  |   if (await titleInput.count() > 0) {
  58  |     await titleInput.fill('[QA] Smoke Test Shift')
  59  |   }
  60  | 
  61  |   // Fill date
  62  |   const dateInput = page.locator('input[type="date"], input[name="shift_date"], #shift_date').first()
  63  |   if (await dateInput.count() > 0) {
  64  |     const tomorrow = new Date()
  65  |     tomorrow.setDate(tomorrow.getDate() + 1)
  66  |     await dateInput.fill(tomorrow.toISOString().slice(0, 10))
  67  |   }
  68  | 
  69  |   // Submit
  70  |   const submitBtn = page.locator('button[type="submit"]').first()
  71  |   if (await submitBtn.count() > 0) {
  72  |     await submitBtn.click()
  73  |     await page.waitForTimeout(2000)
  74  |     // Should not navigate to an error page
  75  |     await expect(page).not.toHaveURL(/error/)
  76  |   }
  77  | })
  78  | 
  79  | test('Assign worker to shift', async ({ page }) => {
  80  |   await loginAsQaAdmin(page)
  81  |   await page.goto(`${BASE_URL}/admin/shifts`)
  82  | 
  83  |   // Click first QA shift that is "scheduled" or "unassigned"
  84  |   const unassignedShift = page.locator('text=[QA]').first()
  85  | 
  86  |   if (await unassignedShift.count() === 0) {
  87  |     test.skip(true, 'No QA shifts found')
  88  |     return
  89  |   }
  90  | 
  91  |   // Click through to the shift detail
  92  |   await unassignedShift.click()
  93  | 
  94  |   // Look for an assign / worker dropdown
  95  |   const assignSection = page.locator('select[name="assigned_staff_id"], #assigned_staff_id, [data-testid="assign-worker"]').first()
  96  |   if (await assignSection.count() > 0) {
  97  |     await assignSection.selectOption({ index: 1 })
  98  |     const saveBtn = page.locator('button:has-text("Save"), button:has-text("Assign"), button[type="submit"]').first()
  99  |     if (await saveBtn.count() > 0) {
  100 |       await saveBtn.click()
  101 |       await page.waitForTimeout(1500)
  102 |       await expect(page).not.toHaveURL(/error/)
  103 |     }
  104 |   }
  105 | })
  106 | 
```