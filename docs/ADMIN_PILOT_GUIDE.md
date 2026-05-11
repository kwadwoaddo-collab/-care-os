# Care OS — Admin First Pilot Guide

**Who this is for:** HR/admin staff using Care OS for the first time.  
**Pilot scope:** Onboarding new staff and managing compliance documents.  
**BrightHR remains the system of record for sign-in, shifts, and payroll.**

---

## Before You Start

- You need an admin login at `/admin/login` (ask your IT contact if you don't have one)
- You need the production URL — this is NOT localhost
- Have the new staff member's email address ready before starting

---

## 1. How to Invite New Staff

New staff are invited as **applicants** and progress through the onboarding flow.

### Step-by-step

1. Go to **Admin → Applicants** (`/admin/applicants`)
2. Click **"+ Invite applicant"** (top-right button)
3. Enter the staff member's:
   - First name
   - Last name
   - Email address
   - Job role
4. Click **Send invite**
5. The system sends an email with a personalised onboarding link
6. The staff member clicks the link on their phone or computer

### What the staff member sees

- A mobile-friendly portal asking them to complete their personal details
- Forms to provide HMRC/banking details
- Document upload section (DBS, right to work, ID)
- Policy acknowledgement (e-signature)

### What happens after they submit

- Their status in **Onboarding Queue** moves to **"Awaiting review"**
- You receive no automatic email — check the queue regularly

---

## 2. How to Track Progress

### Onboarding Queue

Go to **Admin → Onboarding** (`/admin/onboarding`).

The queue shows every staff member in onboarding with:
- **Progress bar** — what percentage of the checklist is complete
- **Stage badge** — Not started / In progress / Awaiting review / Complete
- **Gap badges** — what's still missing (Docs, Compliance, Policy, HMRC, Bank)
- **Stalled warning** — orange badge if in-progress for 7+ days with no update
- **Urgent flag** — red border if activation is blocked by missing critical items

### Filtering the queue

Use the **stage filter buttons** at the top to focus on:
- **Awaiting review** — staff who have submitted and are waiting for you
- **In progress** — staff who started but haven't finished
- **Stalled** — use the "🚨 Urgent" toggle or click the stalled banner

### Finding a specific person

Use the **search box** to filter by name or email.

---

## 3. How to Review Documents

### From the Onboarding Queue

1. Click any staff member's name → opens their staff profile
2. Scroll to the **Documents** section
3. Each uploaded document shows:
   - Document type (DBS, Passport, etc.)
   - Upload date
   - Current review status (Pending / Approved / Rejected)

### Approving a document

1. Click the document row to open the review panel
2. Review the uploaded file (click to download/view)
3. Select **Approve** or **Reject**
4. If rejecting, add a note explaining what's needed
5. Click **Save review**

The staff member's portal will reflect the updated status.

### What counts as a complete document set

At minimum, every staff member needs:
- ✅ Valid DBS check (enhanced, dated within 3 years)
- ✅ Right to work evidence (passport, visa, or share code)
- ✅ Photo ID (if not already covered by right to work)
- ✅ Signed policy acknowledgement

> Cross-reference your internal compliance checklist. Care OS tracks what's uploaded;  
> your compliance officer should confirm documents are valid.

---

## 4. How to Send Reminders

If a staff member hasn't completed their onboarding, you can send a reminder email.

### Single reminder

In the **Onboarding Queue**, each staff member card (not yet complete) has a **📧 Remind** button. Click it to send a reminder immediately.

### Bulk reminders

1. Tick the checkboxes on multiple staff member cards
2. A blue banner appears at the top: **"X workers selected"**
3. Click **"📧 Send reminders to X"**
4. The system sends individual reminder emails to each selected worker

> Reminders are sent to the email address used when they were invited.  
> A confirmation toast confirms how many were sent.

---

## 5. How to Activate Staff

Activation means marking a staff member as **active** (ready for deployment). This is the final step after all onboarding is complete.

### Pre-activation checks

Before activating, the system shows whether these are complete:
- [ ] All required documents uploaded and approved
- [ ] DBS check confirmed
- [ ] Right to work confirmed
- [ ] Policy agreement signed
- [ ] HMRC/banking information submitted

### To activate a staff member

1. Go to the staff member's profile (`/admin/staff/[id]`)
2. Scroll to the **Activation** section
3. Review the activation safety checklist — all blockers must be resolved
4. If all checks pass, click **Activate**
5. Staff status changes from `onboarding` → `active`

> **Important:** Do not activate staff with outstanding compliance blockers.  
> The system will warn you if there are unresolved issues.

### After activation

- The staff member's profile moves from the onboarding queue to the **Staff** list
- Continue to track their compliance (DBS expiry, training renewals) from **Admin → Compliance**

---

## 6. What Not to Use Yet

Care OS is a **pilot**. Some parts of the system are not yet ready for live use.

| Feature | Status | Use instead |
|---|---|---|
| **Shifts / Rota** | Not for pilot | BrightHR / existing rota system |
| **Timesheets** | Not for pilot | BrightHR / existing timesheet system |
| **Visit notes** | Not for pilot | Existing care records / paper |
| **Incidents** | Not for pilot | Existing incident reporting system |
| **Payroll export** | Not built yet | Existing payroll process |
| **CQC report pack** | Not built yet | Manual CQC preparation |
| **Worker app** | Portal only | Workers use the web portal link |

> **In summary:** Use Care OS only for **inviting**, **onboarding**, and **document compliance** during this pilot.

---

## Common Questions

**Q: The staff member says they didn't receive the invite email.**  
A: Check the `notification_logs` table in Supabase, or ask them to check their spam folder. If not found, re-invite using the same email. Resend may take 1–2 minutes.

**Q: The magic link has expired.**  
A: Send a new invite from `/admin/applicants`. The old link is invalidated; the new one is valid for 7 days.

**Q: I approved a document by mistake.**  
A: Open the document review panel and change the status to **Rejected**, adding a correction note. The staff member will see the update in their portal.

**Q: A staff member wants to change their banking details after submission.**  
A: They need to contact admin directly. There is no self-service edit for submitted HMRC/banking forms yet. An admin can view and update their profile directly.

**Q: A staff member is showing as "stalled" but I know they're completing it.**  
A: The stalled flag fires after 7 days with no portal activity. Send a reminder — that also resets the last-contact timestamp.

---

## Getting Help

- For technical issues: contact your IT contact or development team
- For compliance questions: contact your compliance officer
- For urgent data issues: do NOT delete records — preserve them and contact IT

---

*Last updated: May 2026 — Care OS Pilot v1*
