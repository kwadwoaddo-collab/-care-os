// lib/notifications/templates/trainingReminderTemplate.ts
//
// Per-worker individual compliance reminder email.
// Covers: expiring training certs, missing mandatory training, missing required docs.

export interface TrainingReminderInput {
  staffName:       string
  companyName:     string
  portalUrl:       string

  // Items expiring within 30 days — already approved, just need renewal
  expiring: Array<{
    label:      string   // e.g. "Manual Handling"
    daysUntil:  number
    expiryDate: string
  }>

  // Required training with no approved cert at all (or only rejected/pending)
  missingTraining: Array<{
    label: string   // e.g. "Safeguarding"
  }>

  // Required docs missing (passport / right_to_work / dbs)
  missingDocs: Array<{
    label: string   // e.g. "DBS Certificate"
  }>
}

export function trainingReminderTemplate(input: TrainingReminderInput): {
  subject: string
  html:    string
  text:    string
} {
  const { staffName, companyName, portalUrl, expiring, missingTraining, missingDocs } = input

  const totalIssues = expiring.length + missingTraining.length + missingDocs.length

  // Subject: most urgent thing first
  let subject: string
  if (expiring.length > 0 && expiring[0].daysUntil <= 7) {
    subject = `⚠️ Action required: ${expiring[0].label} expires in ${expiring[0].daysUntil} day${expiring[0].daysUntil === 1 ? '' : 's'}`
  } else if (missingTraining.length > 0 || missingDocs.length > 0) {
    subject = `Action required: missing compliance documents — ${companyName}`
  } else {
    subject = `Compliance reminder: ${totalIssues} item${totalIssues !== 1 ? 's' : ''} need attention — ${companyName}`
  }

  // ── HTML ─────────────────────────────────────────────────────────────────

  function urgencyColour(daysUntil: number): string {
    if (daysUntil <= 7)  return '#dc2626'  // red-600
    if (daysUntil <= 14) return '#ea580c'  // orange-600
    return '#ca8a04'                         // yellow-600
  }

  const expiringHtml = expiring.map((e) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">
        <strong style="color:${urgencyColour(e.daysUntil)}">${e.label}</strong>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280">
        Expires ${e.expiryDate}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:${urgencyColour(e.daysUntil)};font-weight:600">
        ${e.daysUntil} day${e.daysUntil === 1 ? '' : 's'}
      </td>
    </tr>`).join('')

  const missingTrainingHtml = missingTraining.map((m) => `
    <tr>
      <td colspan="3" style="padding:8px 12px;border-bottom:1px solid #f3f4f6">
        <span style="color:#dc2626;font-weight:600">🚫 ${m.label}</span>
        <span style="color:#9ca3af;margin-left:8px">— no approved certificate on file. Cannot be activated.</span>
      </td>
    </tr>`).join('')

  const missingDocsHtml = missingDocs.map((d) => `
    <tr>
      <td colspan="3" style="padding:8px 12px;border-bottom:1px solid #f3f4f6">
        <span style="color:#dc2626;font-weight:600">📄 ${d.label}</span>
        <span style="color:#9ca3af;margin-left:8px">— document required but not uploaded.</span>
      </td>
    </tr>`).join('')

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">

    <!-- Header -->
    <div style="background:#4f46e5;padding:24px 28px">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:600">Compliance Action Required</h1>
      <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px">${companyName}</p>
    </div>

    <!-- Body -->
    <div style="padding:28px">
      <p style="color:#374151;margin:0 0 16px">Hello <strong>${staffName}</strong>,</p>
      <p style="color:#6b7280;margin:0 0 24px;font-size:14px">
        Your compliance record requires attention. Please log in to the worker portal and upload the required documents as soon as possible.
      </p>

      ${(expiringHtml || missingTrainingHtml || missingDocsHtml) ? `
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
        <thead>
          <tr style="background:#f9fafb;text-align:left">
            <th style="padding:8px 12px;color:#6b7280;font-weight:500">Item</th>
            <th style="padding:8px 12px;color:#6b7280;font-weight:500">Details</th>
            <th style="padding:8px 12px;color:#6b7280;font-weight:500">Urgency</th>
          </tr>
        </thead>
        <tbody>
          ${expiringHtml}
          ${missingTrainingHtml}
          ${missingDocsHtml}
        </tbody>
      </table>` : ''}

      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:24px">
        <p style="margin:0;font-size:13px;color:#92400e">
          <strong>Important:</strong> Missing or expired training certificates mean you cannot be activated for shifts until they are resolved and approved by your manager.
        </p>
      </div>

      <a href="${portalUrl}"
         style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">
        Open Worker Portal →
      </a>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 28px">
      <p style="margin:0;font-size:12px;color:#9ca3af">
        This is an automated compliance reminder from ${companyName}. If you believe this is an error, please contact your manager.
      </p>
    </div>

  </div>
</body>
</html>`

  // ── Plain text ────────────────────────────────────────────────────────────

  const textParts: string[] = [
    `Hello ${staffName},`,
    '',
    `Your compliance record requires attention for ${companyName}.`,
    '',
  ]

  if (expiring.length > 0) {
    textParts.push('EXPIRING SOON:')
    for (const e of expiring) {
      textParts.push(`  - ${e.label}: expires ${e.expiryDate} (${e.daysUntil} day${e.daysUntil === 1 ? '' : 's'})`)
    }
    textParts.push('')
  }

  if (missingTraining.length > 0) {
    textParts.push('MISSING MANDATORY TRAINING (activation blocked until resolved):')
    for (const m of missingTraining) {
      textParts.push(`  - ${m.label}`)
    }
    textParts.push('')
  }

  if (missingDocs.length > 0) {
    textParts.push('MISSING REQUIRED DOCUMENTS:')
    for (const d of missingDocs) {
      textParts.push(`  - ${d.label}`)
    }
    textParts.push('')
  }

  textParts.push(`Log in to the worker portal: ${portalUrl}`)

  return { subject, html, text: textParts.join('\n') }
}
