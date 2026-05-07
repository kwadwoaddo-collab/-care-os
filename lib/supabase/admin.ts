import 'server-only'
import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
}

// TODO (RLS): This client uses the service role key and bypasses all RLS policies.
// When RLS is enabled, replace with a per-request anon client that inherits the user's
// JWT so Postgres enforces company_id isolation at the DB layer.
// Tables requiring RLS: staff_profiles, applicants, clients, shifts, care_packages,
// visit_notes, incidents, timesheets, documents, audit_logs, compliance_items, interviews.
// Only import this in server-side code (Route Handlers, Server Actions).
// Never import this file in client components or expose it to the browser.
export const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
