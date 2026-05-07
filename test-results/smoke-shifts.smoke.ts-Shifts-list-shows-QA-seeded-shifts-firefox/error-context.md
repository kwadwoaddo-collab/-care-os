# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke/shifts.smoke.ts >> Shifts list shows QA-seeded shifts
- Location: tests/smoke/shifts.smoke.ts:23:5

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
            - heading "Shifts" [level=1] [ref=e25]
            - paragraph [ref=e26]: 0 shifts
          - button "+ Create Shift" [ref=e27]
        - generic [ref=e28]:
          - generic [ref=e29]:
            - paragraph [ref=e30]: Total
            - paragraph [ref=e31]: "0"
          - generic [ref=e32]:
            - paragraph [ref=e33]: Today
            - paragraph [ref=e34]: "0"
          - generic [ref=e35]:
            - paragraph [ref=e36]: Upcoming
            - paragraph [ref=e37]: "0"
          - generic [ref=e38]:
            - paragraph [ref=e39]: Scheduled / Confirmed
            - paragraph [ref=e40]: "0"
        - link "All shifts are assigned View open shifts queue → 0" [ref=e41] [cursor=pointer]:
          - /url: /admin/shifts/open
          - generic [ref=e42]:
            - paragraph [ref=e43]: All shifts are assigned
            - paragraph [ref=e44]: View open shifts queue →
          - generic [ref=e45]: "0"
        - generic [ref=e46]:
          - textbox "Search title, location, client…" [ref=e47]
          - combobox [ref=e48]:
            - 'option "Status: All" [selected]'
            - option "Scheduled"
            - option "Confirmed"
            - option "Completed"
            - option "Cancelled"
            - option "No show"
          - combobox [ref=e49]:
            - 'option "Shift type: All" [selected]'
            - option "Day"
            - option "Night"
            - option "Sleep-in"
            - option "Live-in"
            - option "Emergency"
          - combobox [ref=e50]:
            - 'option "Assignment: All" [selected]'
            - option "Assigned"
            - option "Unassigned"
          - generic [ref=e51]:
            - generic [ref=e52]: From date
            - textbox [ref=e53]
          - generic [ref=e54]:
            - generic [ref=e55]: To date
            - textbox [ref=e56]
          - button "Search" [ref=e57]
        - generic [ref=e58]:
          - img [ref=e60]
          - paragraph [ref=e62]: No shifts yet
          - paragraph [ref=e63]:
            - text: Create a shift manually above, or generate shifts automatically from a
            - link "care package" [ref=e64] [cursor=pointer]:
              - /url: /admin/care-packages
            - text: .
  - button "Open Next.js Dev Tools" [ref=e70] [cursor=pointer]:
    - img [ref=e71]
  - alert [ref=e75]
```

# Test source

```ts
  1  | /**
  2  |  * tests/smoke/shifts.smoke.ts
  3  |  *
  4  |  * Smoke tests: Shift list, creation, and worker assignment.
  5  |  *
  6  |  * Auth: loaded from storageState (see playwright.config.ts).
  7  |  * Each test gets an isolated browser context pre-seeded with the QA admin
  8  |  * session — no per-test Supabase login needed.
  9  |  *
  10 |  * Usage:
  11 |  *   npx playwright test tests/smoke/shifts.smoke.ts
  12 |  */
  13 | 
  14 | import { test, expect } from '@playwright/test'
  15 | import { expectAdminPage } from './helpers/auth'
  16 | 
  17 | test('Shifts list is accessible and renders', async ({ page }) => {
  18 |   await expectAdminPage(page, '/admin/shifts')
  19 | 
  20 |   await expect(page.locator('h1, h2').first()).toBeVisible()
  21 | })
  22 | 
  23 | test('Shifts list shows QA-seeded shifts', async ({ page }) => {
  24 |   await expectAdminPage(page, '/admin/shifts')
  25 | 
  26 |   await page.waitForTimeout(1_500)
  27 |   const qaShiftCount = await page.locator('text=[QA]').count()
> 28 |   expect(qaShiftCount).toBeGreaterThan(0)
     |                        ^ Error: expect(received).toBeGreaterThan(expected)
  29 | })
  30 | 
  31 | test('Create a shift via admin UI', async ({ page }) => {
  32 |   await expectAdminPage(page, '/admin/shifts')
  33 | 
  34 |   const newShiftBtn = page.locator(
  35 |     'a:has-text("New Shift"), a:has-text("Add Shift"), button:has-text("New Shift"), button:has-text("Add Shift"), a:has-text("Create Shift")'
  36 |   ).first()
  37 | 
  38 |   if (await newShiftBtn.count() === 0) {
  39 |     test.skip(true, 'No "New Shift" button found — UI may differ')
  40 |     return
  41 |   }
  42 | 
  43 |   await newShiftBtn.click()
  44 | 
  45 |   const titleInput = page.locator('input[name="title"], #title, input[placeholder*="title" i]').first()
  46 |   if (await titleInput.count() > 0) {
  47 |     await titleInput.fill('[QA] Smoke Test Shift')
  48 |   }
  49 | 
  50 |   const dateInput = page.locator('input[type="date"], input[name="shift_date"], #shift_date').first()
  51 |   if (await dateInput.count() > 0) {
  52 |     const tomorrow = new Date()
  53 |     tomorrow.setDate(tomorrow.getDate() + 1)
  54 |     await dateInput.fill(tomorrow.toISOString().slice(0, 10))
  55 |   }
  56 | 
  57 |   const submitBtn = page.locator('button[type="submit"]').first()
  58 |   if (await submitBtn.count() > 0) {
  59 |     await submitBtn.click()
  60 |     await page.waitForTimeout(2_000)
  61 |     await expect(page).not.toHaveURL(/error/)
  62 |   }
  63 | })
  64 | 
  65 | test('Assign worker to shift', async ({ page }) => {
  66 |   await expectAdminPage(page, '/admin/shifts')
  67 | 
  68 |   const unassignedShift = page.locator('text=[QA]').first()
  69 | 
  70 |   if (await unassignedShift.count() === 0) {
  71 |     test.skip(true, 'No QA shifts found')
  72 |     return
  73 |   }
  74 | 
  75 |   await unassignedShift.click()
  76 | 
  77 |   const assignSection = page.locator('select[name="assigned_staff_id"], #assigned_staff_id, [data-testid="assign-worker"]').first()
  78 |   if (await assignSection.count() > 0) {
  79 |     await assignSection.selectOption({ index: 1 })
  80 |     const saveBtn = page.locator('button:has-text("Save"), button:has-text("Assign"), button[type="submit"]').first()
  81 |     if (await saveBtn.count() > 0) {
  82 |       await saveBtn.click()
  83 |       await page.waitForTimeout(1_500)
  84 |       await expect(page).not.toHaveURL(/error/)
  85 |     }
  86 |   }
  87 | })
  88 | 
```