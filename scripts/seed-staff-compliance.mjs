#!/usr/bin/env node
/**
 * scripts/seed-staff-compliance.mjs
 *
 * Dev-only seed: inserts a full set of compliant documents for a staff member
 * so the "Activate Staff" button can be tested without manual uploads.
 *
 * Usage:
 *   node scripts/seed-staff-compliance.mjs <staff_profile_id>
 *
 * Reads from .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync }  from 'fs'
import ws               from 'ws'
import { resolve }       from 'path'

// ── Load .env.local ────────────────────────────────────────────────────────────

const envPath = resolve(process.cwd(), '.env.local')
let envText
try {
  envText = readFileSync(envPath, 'utf8')
} catch {
  console.error('❌  Could not read .env.local — make sure you run this from the project root.')
  process.exit(1)
}

/** Parse key=value lines; handles quoted values and ignores comments */
function parseEnv(text) {
  const result = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue
    const key = line.slice(0, eqIdx).trim()
    let val    = line.slice(eqIdx + 1).trim()
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    result[key] = val
  }
  return result
}

const env = parseEnv(envText)

const supabaseUrl     = env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey  = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// ── CLI arg ────────────────────────────────────────────────────────────────────

const staffProfileId = process.argv[2]
if (!staffProfileId) {
  console.error('❌  Usage: node scripts/seed-staff-compliance.mjs <staff_profile_id>')
  process.exit(1)
}

// ── Supabase client ────────────────────────────────────────────────────────────

// Node 20 has no native WebSocket — pass ws as the realtime transport
// so Supabase doesn't throw the "no native WebSocket support" error.
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession:   false,
  },
  realtime: {
    transport: ws,
  },
})

// ── Document definitions ───────────────────────────────────────────────────────
// File names are chosen to match TRAINING_KEYWORDS in lib/compliance/requirements.ts
// so the compliance engine's keyword inference picks them up automatically.

const SEED_DOCS = [
  {
    document_type: 'passport',
    file_name:     'passport.pdf',
    expiry_date:   '2030-01-01',
  },
  {
    document_type: 'right_to_work',
    file_name:     'right-to-work.pdf',
    expiry_date:   '2030-01-01',
  },
  {
    document_type: 'dbs',
    file_name:     'dbs-certificate.pdf',
    expiry_date:   '2027-01-01',
  },
  // Training certificates — file names contain the keywords the compliance
  // engine searches for (case-insensitive substring match).
  {
    document_type: 'training_certificate',
    file_name:     'manual-handling.pdf',        // keyword: manual-handling
    expiry_date:   '2027-01-01',
  },
  {
    document_type: 'training_certificate',
    file_name:     'safeguarding.pdf',            // keyword: safeguarding
    expiry_date:   '2027-01-01',
  },
  {
    document_type: 'training_certificate',
    file_name:     'basic-life-support.pdf',      // keyword: basic-life-support
    expiry_date:   '2027-01-01',
  },
  {
    document_type: 'training_certificate',
    file_name:     'infection-control.pdf',       // keyword: infection-control
    expiry_date:   '2027-01-01',
  },
  {
    document_type: 'training_certificate',
    file_name:     'health-safety.pdf',           // keyword: health-safety
    expiry_date:   '2027-01-01',
  },
]

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍  Looking up staff profile: ${staffProfileId}`)

  // 1. Fetch staff profile
  const { data: staffProfile, error: spError } = await supabase
    .from('staff_profiles')
    .select('id, company_id, applicant_id')
    .eq('id', staffProfileId)
    .maybeSingle()

  if (spError) {
    console.error('❌  Failed to fetch staff profile:', spError.message)
    process.exit(1)
  }
  if (!staffProfile) {
    console.error(`❌  Staff profile not found: ${staffProfileId}`)
    process.exit(1)
  }

  const { company_id: companyId, applicant_id: applicantId } = staffProfile
  console.log(`✅  Found staff profile`)
  console.log(`    company_id:   ${companyId}`)
  console.log(`    applicant_id: ${applicantId ?? '(none)'}`)

  // 2. Delete existing seed documents for this staff_profile_id (idempotent)
  console.log(`\n🗑   Removing previous seed documents for this staff member…`)
  const { error: deleteError, count: deleteCount } = await supabase
    .from('documents')
    .delete({ count: 'exact' })
    .eq('staff_profile_id', staffProfileId)
    .like('file_path', 'seed/%')

  if (deleteError) {
    console.error('❌  Failed to delete existing seed documents:', deleteError.message)
    process.exit(1)
  }
  console.log(`    Removed ${deleteCount ?? 0} existing seed document(s).`)

  // 3. Build insert rows
  const rows = SEED_DOCS.map((doc) => {
    const filePath = `seed/${companyId}/staff/${staffProfileId}/${doc.document_type}/${doc.file_name}`
    return {
      company_id:       companyId,
      staff_profile_id: staffProfileId,
      ...(applicantId ? { applicant_id: applicantId } : {}),
      document_type:    doc.document_type,
      file_name:        doc.file_name,
      file_path:        filePath,
      file_size:        1024,
      mime_type:        'application/pdf',
      expiry_date:      doc.expiry_date,
    }
  })

  // 4. Insert
  console.log(`\n📄  Inserting ${rows.length} seed documents…`)
  const { data: inserted, error: insertError } = await supabase
    .from('documents')
    .insert(rows)
    .select('id, document_type, file_name, expiry_date')

  if (insertError) {
    console.error('❌  Insert failed:', insertError.message)
    if (insertError.details)  console.error('    details:', insertError.details)
    if (insertError.hint)     console.error('    hint:',    insertError.hint)
    process.exit(1)
  }

  // 5. Print results
  console.log(`\n✅  Inserted ${inserted.length} document(s):\n`)
  for (const doc of inserted) {
    console.log(`    [${doc.document_type.padEnd(22)}]  ${doc.file_name}  (expires ${doc.expiry_date})`)
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  Seed complete. Staff member should now be compliant.
    Refresh the staff detail page and test Activate Staff.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

main().catch((err) => {
  console.error('❌  Unexpected error:', err)
  process.exit(1)
})
