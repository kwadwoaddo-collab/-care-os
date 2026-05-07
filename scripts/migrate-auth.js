#!/usr/bin/env node

/**
 * Migration script: replaces DEV_BYPASS_AUTH pattern with requireAdmin()
 * across all admin API route files.
 *
 * Pattern replaced:
 *   // TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH ...
 *   const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'
 *
 * And in each handler function:
 *   if (!DEV_BYPASS_AUTH) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 *   }
 *
 * Replaced with:
 *   const auth = await requireAdmin()
 *   if (!auth.ok) return auth.response
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Find all admin route files with DEV_BYPASS_AUTH
const files = execSync(
  `grep -rn "const DEV_BYPASS_AUTH" app/api/admin/ --include="*.ts" -l`,
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean)

console.log(`Found ${files.length} files to migrate\n`)

let totalReplacements = 0

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8')
  const original = content
  let changes = 0

  // 1. Remove the DEV_BYPASS_AUTH declaration and TODO comment
  content = content.replace(
    /\/\/ TODO: RESTORE AUTH[^\n]*\n\s*const DEV_BYPASS_AUTH\s*=\s*process\.env\.NODE_ENV\s*===\s*'development'\s*\n/g,
    ''
  )
  // Also handle case where there's no TODO line
  content = content.replace(
    /const DEV_BYPASS_AUTH\s*=\s*process\.env\.NODE_ENV\s*===\s*'development'\s*\n/g,
    ''
  )

  // 2. Replace all auth guard blocks
  // Pattern: if (!DEV_BYPASS_AUTH) {\n    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })\n  }
  const guardPattern = /\s*if\s*\(\s*!DEV_BYPASS_AUTH\s*\)\s*\{[^}]*return\s+NextResponse\.json\(\s*\{\s*error:\s*'Unauthorized'\s*\}\s*,\s*\{\s*status:\s*401\s*\}\s*\)\s*\}\s*\n/g
  const guardCount = (content.match(guardPattern) || []).length
  content = content.replace(
    guardPattern,
    '\n  const auth = await requireAdmin()\n  if (!auth.ok) return auth.response\n\n'
  )
  changes += guardCount

  // 3. Add requireAdmin import if not already present and changes were made
  if (content !== original && !content.includes("from '@/lib/auth/requireAdmin'")) {
    // Add after the last import
    const lastImportIdx = content.lastIndexOf('\nimport ')
    if (lastImportIdx >= 0) {
      const endOfLine = content.indexOf('\n', lastImportIdx + 1)
      content = content.slice(0, endOfLine + 1) +
        "import { requireAdmin } from '@/lib/auth/requireAdmin'\n" +
        content.slice(endOfLine + 1)
    }
  }

  // 4. Remove unused NextResponse import if it's only used for the auth guard
  // (keep it — most files use NextResponse for other responses too)

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8')
    console.log(`✓ ${file} (${guardCount} guard(s) replaced)`)
    totalReplacements += guardCount
  } else {
    console.log(`⊘ ${file} (no changes needed)`)
  }
}

console.log(`\nDone. ${totalReplacements} total guard blocks replaced across ${files.length} files.`)
