#!/usr/bin/env node

/**
 * Adds .eq('company_id', companyId) to list endpoint queries.
 * Targets the main SELECT query for each table.
 */

const fs = require('fs')

const ROUTES = [
  // [file, table, insertAfterPattern]
  // Each tuple defines where to inject the company filter.
  // We inject after the first .select() call on the target table.
  ['app/api/admin/applicants/route.ts',    'applicants'],
  ['app/api/admin/clients/route.ts',       'clients'],
  ['app/api/admin/shifts/route.ts',        'shifts'],
  ['app/api/admin/staff/route.ts',         'staff_profiles'],
  ['app/api/admin/timesheets/route.ts',    'timesheets'],
  ['app/api/admin/visit-notes/route.ts',   'visit_notes'],
  ['app/api/admin/incidents/route.ts',     'incidents'],
  ['app/api/admin/care-packages/route.ts', 'care_packages'],
  ['app/api/admin/interviews/route.ts',    'interviews'],
  ['app/api/admin/audit-log/route.ts',     'audit_logs'],
  ['app/api/admin/documents/route.ts',     'documents'],
]

let modified = 0

for (const [file, table] of ROUTES) {
  let content = fs.readFileSync(file, 'utf8')
  const original = content

  // Find .from('table') and then the next .order() or .limit() after it
  // Insert .eq('company_id', companyId) before the .order()
  const fromStr = `.from('${table}')`
  const idx = content.indexOf(fromStr)
  if (idx === -1) {
    console.log(`⊘ ${file} — .from('${table}') not found`)
    continue
  }

  // Find the .order( after .from()
  const afterFrom = content.slice(idx)
  const orderMatch = afterFrom.match(/\n(\s*)\.order\(/)
  const limitMatch = afterFrom.match(/\n(\s*)\.limit\(/)
  
  let insertPoint, indent
  
  if (orderMatch) {
    insertPoint = idx + orderMatch.index
    indent = orderMatch[1]
  } else if (limitMatch) {
    insertPoint = idx + limitMatch.index
    indent = limitMatch[1]
  } else {
    console.log(`⊘ ${file} — no .order() or .limit() found after .from('${table}')`)
    continue
  }

  // Insert the company filter
  const filter = `\n${indent}.eq('company_id', companyId)`
  content = content.slice(0, insertPoint) + filter + content.slice(insertPoint)

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8')
    modified++
    console.log(`✓ ${file}`)
  }
}

console.log(`\nDone. ${modified} list endpoints scoped.`)
