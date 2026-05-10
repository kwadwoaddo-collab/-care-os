#!/usr/bin/env tsx
/**
 * Send a test email via Resend to verify domain and API key configuration.
 *
 * Usage:
 *   npm run email:test -- recipient@example.com
 *
 * Requires RESEND_API_KEY and EMAIL_FROM (or INVITE_FROM_EMAIL) to be set.
 */

import * as dotenv from 'dotenv'
import * as path   from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const recipient = process.argv[2]

if (!recipient) {
  console.error('Error: recipient email address is required.')
  console.error('Usage: npm run email:test -- your@email.com')
  process.exit(1)
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
  console.error(`Error: "${recipient}" is not a valid email address.`)
  process.exit(1)
}

const apiKey  = process.env.RESEND_API_KEY
const from    = process.env.EMAIL_FROM ?? process.env.INVITE_FROM_EMAIL
const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

if (!apiKey) {
  console.error('Error: RESEND_API_KEY is not set in .env.local')
  process.exit(1)
}
if (!from) {
  console.error('Error: EMAIL_FROM (or INVITE_FROM_EMAIL) is not set in .env.local')
  process.exit(1)
}

console.log(`\nSending test email...`)
console.log(`  From:      ${from}`)
console.log(`  To:        ${recipient}`)
console.log(`  App URL:   ${appUrl}`)
console.log()

const { Resend } = await import('resend')
const resend = new Resend(apiKey)

const { data, error } = await resend.emails.send({
  from,
  to:      recipient,
  subject: 'Care OS — email configuration test',
  html: `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
      <h2 style="color:#1a1a2e;">Care OS — Email Test</h2>
      <p>This is a test email confirming that your Resend integration is working correctly.</p>
      <ul>
        <li><strong>From:</strong> ${from}</li>
        <li><strong>App URL:</strong> ${appUrl}</li>
        <li><strong>Sent at:</strong> ${new Date().toISOString()}</li>
      </ul>
      <p style="color:#6b7280;font-size:13px;">You can delete this email — no action is required.</p>
    </div>
  `,
  text: [
    'Care OS — Email Test',
    '',
    'This is a test email confirming that your Resend integration is working correctly.',
    '',
    `From:     ${from}`,
    `App URL:  ${appUrl}`,
    `Sent at:  ${new Date().toISOString()}`,
    '',
    'You can delete this email — no action is required.',
  ].join('\n'),
})

if (error) {
  console.error('Failed:', error.message ?? String(error))
  process.exit(1)
}

console.log(`Success! Email sent.`)
console.log(`  Message ID: ${data?.id ?? 'n/a'}`)
console.log()
