#!/usr/bin/env node

/**
 * Migration script: adds company isolation to all admin routes.
 * 
 * Pattern: after `const auth = await requireAdmin()`, extract companyId,
 * then add .eq('company_id', companyId) to main queries.
 *
 * This script handles the structural change:
 *   const auth = await requireAdmin()
 *   if (!auth.ok) return auth.response
 * becomes:
 *   const auth = await requireAdmin()
 *   if (!auth.ok) return auth.response
 *   const { companyId } = auth.ctx
 */

const fs = require('fs')
const { execSync } = require('child_process')

const files = execSync(
  `grep -rn "requireAdmin" app/api/admin/ --include="*.ts" -l`,
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean)

console.log(`Found ${files.length} files to add company context extraction\n`)

let modified = 0

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8')
  const original = content

  // Only process files that DON'T already destructure companyId from auth.ctx
  if (content.includes('auth.ctx')) {
    console.log(`⊘ ${file} (already uses auth.ctx)`)
    continue
  }

  // Add { companyId } destructuring after the auth guard
  content = content.replace(
    /(\s*const auth = await requireAdmin\(\)\n\s*if \(!auth\.ok\) return auth\.response)\n/g,
    '$1\n  const { companyId } = auth.ctx\n'
  )

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8')
    modified++
    console.log(`✓ ${file}`)
  } else {
    console.log(`⊘ ${file} (no match)`)
  }
}

console.log(`\nDone. ${modified} files updated with companyId extraction.`)
