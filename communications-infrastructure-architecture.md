# Operational Communications Infrastructure — Architecture

## Overview

The Operational Communications system is a structured messaging layer built on top of Care OS's existing `in_app_notifications` and `notification_logs` infrastructure. It centralises all operational communication — broadcasts, compliance reminders, safeguarding escalations, and shift communications — into a governed, auditable, and multi-channel platform.

**Problem solved:** Fragmented communication across WhatsApp, SMS, email, and verbal handovers is replaced with tracked, deduplicated, and role-appropriate messaging inside Care OS.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  Admin Communications Panel                  │
│           /admin/communications                              │
│  ┌────────────┐ ┌──────────────┐ ┌───────────┐             │
│  │ Message    │ │  Broadcast   │ │ Templates │             │
│  │   List     │ │  Composer    │ │  Library  │             │
│  └─────┬──────┘ └──────┬───────┘ └─────┬─────┘             │
└────────┼───────────────┼───────────────┼────────────────────┘
         │               │               │
         ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│               API Layer (/api/admin/communications/*)        │
│  route.ts     broadcast/   [id]/reply/   templates/          │
│  [id]/route   recipients/  triggers/                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────────┐
         ▼                 ▼                      ▼
┌────────────────┐  ┌──────────────┐   ┌─────────────────────┐
│ lib/communications│  │Existing Notif│   │  Supabase DB (048)  │
│  deliver.ts   │  │ createNotif  │   │  operational_messages│
│  suppress.ts  │  │ sendEmail    │   │  message_recipients  │
└───────┬───────┘  └──────────────┘   │  message_templates   │
        │                             │  message_suppression │
        │  fires                      └─────────────────────┘
        ▼
┌─────────────────────────────────────────────────────────────┐
│             Delivery Channels                                │
│  ┌───────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │ in_app_notif  │  │ Email (Resend)│  │ SMS (future)   │   │
│  │  (existing)   │  │ notification_│  │                │   │
│  └───────────────┘  │    logs      │  └────────────────┘   │
│                     └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Worker Communication Hub                   │
│          /worker/messages                                    │
│  Unified inbox: operational_messages + in_app_notifications │
│  Tabs: All | Unread | Compliance | Shifts                   │
│  Acknowledge + Read tracking                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Migration 048)

### `operational_messages`

Core message table. Every broadcast, reminder, or auto-generated alert creates one row.

| Field          | Type    | Notes |
|----------------|---------|-------|
| id             | UUID    | PK |
| company_id     | UUID    | Tenant-scoped |
| sender_id      | UUID    | profiles.id — NULL for system |
| sender_name    | TEXT    | Resolved at send time |
| subject        | TEXT    | Message headline |
| body           | TEXT    | Full message body |
| message_type   | TEXT    | See types below |
| priority       | TEXT    | normal / urgent / critical |
| channel        | TEXT    | in_app / email / multi |
| audience_type  | TEXT    | See audience types below |
| audience_filter| JSONB   | Role list, compliance states, etc. |
| thread_id      | UUID    | Self-ref: set for replies |
| auto_generated | BOOLEAN | TRUE = created by smart trigger |
| trigger_type   | TEXT    | compliance_expiry / onboarding_stall / etc. |
| status         | TEXT    | draft / sending / sent / failed |
| recipient_count| INT     | Resolved at delivery time |
| sent_at        | TIMESTAMPTZ | NULL until delivered |

**Message types:** `announcement`, `compliance_reminder`, `staffing_alert`, `onboarding_reminder`, `safeguarding_escalation`, `shift_communication`, `broadcast`, `thread_reply`

**Audience types:** `all_staff`, `by_role`, `by_compliance_state`, `by_shift_group`, `by_onboarding_stage`, `individual`

---

### `message_recipients`

Per-recipient delivery tracking row. One row per (message × recipient × channel).

| Field           | Type    | Notes |
|-----------------|---------|-------|
| message_id      | UUID    | FK → operational_messages |
| staff_profile_id| UUID    | Worker recipient |
| profile_id      | UUID    | Admin recipient |
| delivery_channel| TEXT    | in_app / email / sms |
| status          | TEXT    | pending / sent / delivered / read / acknowledged / failed |
| sent_at         | TIMESTAMPTZ ||
| read_at         | TIMESTAMPTZ | Set when worker opens message |
| acknowledged_at | TIMESTAMPTZ | Set when worker taps Acknowledge |
| error_message   | TEXT    | On delivery failure |

---

### `message_templates`

Reusable message templates. System templates (`is_system=TRUE`) are seeded in the migration and are not editable.

**9 built-in system templates:**
1. DBS Expiry Reminder
2. Right to Work Expiry
3. Missing Documents Reminder
4. Onboarding Incomplete
5. Uncovered Shift Alert
6. Shift Reminder
7. Safeguarding Escalation
8. Compliance Override Notice
9. Welcome to Onboarding

---

### `message_suppression`

Prevents duplicate/spam messages within configurable windows.

| Field           | Notes |
|-----------------|-------|
| suppression_key | e.g. `compliance_expiry:staff_uuid:dbs` |
| suppressed_until| Datetime after which resending is allowed |
| message_id      | The last message that triggered suppression |

**Default windows:**
- Compliance expiry: 24 hours
- Onboarding stall: 72 hours
- Uncovered shift: 6 hours
- Safeguarding alert: 4 hours

---

## Delivery Engine (`lib/communications/deliver.ts`)

`deliverMessage(spec, recipients)` handles multi-channel delivery:

1. **in_app**: Calls `createNotification()` (existing deduplication-aware system). Creates `in_app_notifications` rows.
2. **email**: Calls `centralSendEmail()` (Resend). Writes to `notification_logs` (existing audit trail). 
3. **multi**: Both channels simultaneously.
4. Updates `message_recipients` rows with delivery status and timestamps.
5. Updates `operational_messages.status` to `sent` or `failed`.

The delivery engine **never replaces** the existing notification system — it calls into it. This means:
- Existing notification deduplication (24h window in `createNotification`) still applies.
- All emails still appear in `/admin/notifications` (notification_logs).
- The `in_app_notifications` bell still shows worker alerts.

---

## Smart Triggers (`/api/admin/communications/triggers`)

Scans for four conditions and auto-generates messages:

| Trigger | Condition | Suppress Window | Recipient |
|---------|-----------|-----------------|-----------|
| `compliance_expiry` | compliance items expiring within 30 days | 24h | Individual staff |
| `onboarding_stall` | pre_employment > 30 days | 72h | Individual staff |
| `uncovered_shift` | scheduled shifts with no staff, ≤48h away | 6h | Coordinators/admins |
| `safeguarding_alert` | high/critical open incidents with no escalation | 4h | Registered managers |

Supports `dry_run: true` to preview trigger counts without sending.

Safe to call from a cron job or from the admin UI. Each trigger type uses a unique suppression key per entity to prevent spam.

---

## Audience Resolution (`broadcast/route.ts`)

| Audience Type | Resolution |
|---------------|-----------|
| `all_staff` | All staff_profiles WHERE status IN (active, pre_employment) |
| `by_role` | profiles WHERE role IN (selected_roles) |
| `by_compliance_state` | staff_profiles WHERE any compliance item matches state |
| `by_onboarding_stage` | staff_profiles WHERE status matches stage |
| `individual` | staff_profiles WHERE id IN (staff_ids) |

---

## Conversation Threads

Messages support nested replies via `thread_id` and `parent_id`:

```
operational_messages (root, thread_id = NULL)
  └── operational_messages (reply, thread_id = root.id, message_type = 'thread_reply')
  └── operational_messages (reply, thread_id = root.id, message_type = 'thread_reply')
```

Replies are fetched and displayed in the message detail view (`/admin/communications/[id]`) under the Thread tab. The reply form is available to any admin with `notifications:read` permission.

---

## Worker Communication Hub (`/worker/messages`)

The worker portal shows a unified message inbox combining:
- `message_recipients` rows (operational_messages) — full body, priority, acknowledgement
- `in_app_notifications` rows (existing) — shift offers, compliance alerts, etc.

**Features:**
- Unread count badge in nav
- Filter tabs: All | Unread | Compliance | Shifts
- Expand/collapse per message
- Automatic read tracking on open
- Manual Acknowledge button for operational messages
- Styled by priority: critical = red left border, urgent = amber

---

## RBAC

| Permission | Roles |
|------------|-------|
| `notifications:read` | coordinator, compliance_manager, registered_manager, company_admin, super_admin |

All communications API routes check `notifications:read`. Message creation (POST) and broadcasting also require `notifications:read` — the same permission that controls the existing notification panel.

---

## Notification Hygiene

Three layers prevent spam:

1. **`message_suppression` table** — per-entity, per-trigger suppression windows. Shared across manual and automated sends.
2. **`createNotification` deduplication** — existing 24h window in `in_app_notifications`. Prevents duplicate bell alerts for the same event+entity.
3. **Delivery channel gating** — email is only sent when `channel = email | multi` AND recipient has an email address. No silent failures — all attempts logged.

---

## Audit Trail

Every message send is tracked:
- `operational_messages` row (created/status/sent_at)
- `message_recipients` rows (per-recipient delivery + read + ack timestamps)
- `notification_logs` rows (email attempts — existing audit system)
- `audit_logs` row (message.created / message.broadcast events with actor + metadata)

---

## Integration Points

| System | Integration |
|--------|-------------|
| Compliance engine | Smart trigger scans `staff_compliance` for expiries |
| Operations queue | Uncovered shift trigger scans `shifts` table |
| Incident system | Safeguarding trigger scans `incidents` table |
| Staff timeline | Messages appear via `in_app_notifications` (existing timeline) |
| Notification logs | All email sends appear in `/admin/notifications` |
| Tenant config | Per-tenant notification preferences respected |
| Audit log | All broadcast events written to `audit_logs` |

---

## SMS / Push Notification Readiness

The `delivery_channel` column in `message_recipients` accepts `sms` as a value. The `channel` column in `operational_messages` is designed for extension. To add SMS:

1. Add an SMS provider client (e.g. Twilio) to `lib/email/`
2. Extend `deliver.ts` with an `sms` branch (same pattern as email)
3. Add `sms` to the channel selector in the broadcast composer

Push notifications (e.g. Firebase/APNS) follow the same pattern via a new `push` channel value.

---

## File Map

```
lib/communications/
  deliver.ts           — multi-channel delivery engine
  suppress.ts          — spam suppression helpers

app/api/admin/communications/
  route.ts             — GET (list) / POST (create draft)
  [id]/route.ts        — GET detail + thread + stats / DELETE draft
  [id]/reply/route.ts  — POST reply to thread
  [id]/recipients/route.ts — GET delivery status / PATCH acknowledge
  broadcast/route.ts   — POST broadcast (resolve audience + deliver)
  templates/route.ts   — GET / POST templates
  triggers/route.ts    — POST smart trigger scan

app/api/worker/messages/
  route.ts             — GET unified inbox / PATCH mark read

app/admin/communications/
  page.tsx             — Communications centre (list + stats + triggers)
  [id]/page.tsx        — Message detail (body + recipients + thread)
  broadcast/page.tsx   — Broadcast composer (template picker + audience)
  templates/page.tsx   — Template library (system + custom)

app/worker/messages/
  page.tsx             — Worker communication hub

supabase/migrations/
  048_operational_communications.sql
```
