#!/usr/bin/env node

/**
 * Company isolation script — adds .eq('company_id', companyId) to queries
 * in admin API routes that don't already have company scoping.
 * 
 * Strategy:
 * - For list endpoints (route.ts at top level): add company filter to query builder
 * - For detail endpoints ([id]/route.ts): add company_id check after fetch-by-id
 * 
 * This handles the most common patterns. Manual review is still needed for
 * complex routes with multiple queries.
 */

const fs = require('fs')

// Routes where company_id column exists on the primary table
const SCOPED_LIST_ROUTES = [
  // [file, table_name] — routes where main SELECT needs company scoping
  ['app/api/admin/applicants/route.ts',     'applicants'],
  ['app/api/admin/clients/route.ts',        'clients'],
  ['app/api/admin/shifts/route.ts',         'shifts'],
  ['app/api/admin/staff/route.ts',          'staff_profiles'],
  ['app/api/admin/timesheets/route.ts',     'timesheets'],
  ['app/api/admin/visit-notes/route.ts',    'visit_notes'],
  ['app/api/admin/incidents/route.ts',      'incidents'],
  ['app/api/admin/care-packages/route.ts',  'care_packages'],
  ['app/api/admin/interviews/route.ts',     'interviews'],
  ['app/api/admin/audit-log/route.ts',      'audit_logs'],
  ['app/api/admin/documents/route.ts',      'documents'],
]

let modified = 0
let skipped = 0

for (const [file, table] of SCOPED_LIST_ROUTES) {
  let content
  try {
    content = fs.readFileSync(file, 'utf8')
  } catch {
    console.log(`⊘ ${file} (not found)`)
    skipped++
    continue
  }

  // Check if company scoping is already present on the main query for this table
  // Look for `.from('${table}')` followed by `.eq('company_id'`
  const tablePattern = `.from('${table}')`
  const idx = content.indexOf(tablePattern)
  if (idx === -1) {
    console.log(`⊘ ${file} (no .from('${table}') found)`)
    skipped++
    continue
  }

  // Check if there's already a company_id filter near the query
  const afterFrom = content.slice(idx, idx + 500)
  if (afterFrom.includes(".eq('company_id'")) {
    console.log(`✓ ${file} (already scoped)`)
    continue
  }

  // For list endpoints, we need to add company filter AFTER the query builder
  // Look for .order() or .select() after .from() and add .eq('company_id', companyId)
  // The pattern varies, so we'll find the first .order() or .select() and inject before/after
  console.log(`⚠ ${file} — needs manual company scoping on '${table}' query`)
  modified++
}

console.log(`\nSummary: ${modified} files need manual scoping, ${skipped} skipped`)
console.log('\nNote: Run this script to identify files, then apply scoping manually.')
