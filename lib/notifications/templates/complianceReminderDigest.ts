import { emailShell, alertBox, ctaButton } from './shell'
import type { ReminderPayload } from '@/lib/compliance/reminders'

export interface ComplianceDigestData {
  companyName:  string
  date:         string
  expired:      ReminderPayload[]
  expiringSoon: ReminderPayload[]
  missing:      ReminderPayload[]
  adminLink:    string
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function itemTable(rows: { name: string; itemType: string; date: string | null }[]): string {
  const trs = rows
    .map(
      (r) => `<tr>
        <td style="padding:7px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;">${r.name}</td>
        <td style="padding:7px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;">${r.itemType.replace(/_/g, ' ')}</td>
        <td style="padding:7px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;">${r.date ?? '—'}</td>
      </tr>`,
    )
    .join('')

  return `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 20px;">
    <thead>
      <tr style="background:#f9fafb;">
        <th style="padding:7px 12px;font-size:11px;text-align:left;color:#6b7280;text-transform:uppercase;">Staff member</th>
        <th style="padding:7px 12px;font-size:11px;text-align:left;color:#6b7280;text-transform:uppercase;">Item</th>
        <th style="padding:7px 12px;font-size:11px;text-align:left;color:#6b7280;text-transform:uppercase;">Date</th>
      </tr>
    </thead>
    <tbody>${trs}</tbody>
  </table>`
}

export function complianceReminderDigestTemplate(
  d: ComplianceDigestData,
): { subject: string; html: string; text: string } {
  const total = d.expired.length + d.expiringSoon.length + d.missing.length
  const subject = `Care OS Compliance Reminders — ${d.date} (${total} item${total !== 1 ? 's' : ''})`

  const sections: string[] = []
  const textLines: string[] = []

  if (d.expired.length > 0) {
    sections.push(
      `<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#dc2626;">Expired (${d.expired.length})</p>` +
      alertBox(`${d.expired.length} compliance item${d.expired.length !== 1 ? 's have' : ' has'} expired and require immediate renewal.`, 'red') +
      itemTable(d.expired.map((r) => ({ name: r.staffName, itemType: r.itemType, date: formatDate(r.expiresAt) }))),
    )
    textLines.push(
      `EXPIRED (${d.expired.length}):`,
      ...d.expired.map((r) => `  - ${r.staffName}: ${r.itemType.replace(/_/g, ' ')} (expired ${formatDate(r.expiresAt)})`),
      '',
    )
  }

  if (d.expiringSoon.length > 0) {
    sections.push(
      `<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#d97706;">Expiring soon (${d.expiringSoon.length})</p>` +
      alertBox(`${d.expiringSoon.length} compliance item${d.expiringSoon.length !== 1 ? 's are' : ' is'} expiring within 30 days.`, 'amber') +
      itemTable(d.expiringSoon.map((r) => ({ name: r.staffName, itemType: r.itemType, date: formatDate(r.expiresAt) }))),
    )
    textLines.push(
      `EXPIRING SOON (${d.expiringSoon.length}):`,
      ...d.expiringSoon.map((r) => `  - ${r.staffName}: ${r.itemType.replace(/_/g, ' ')} (expires ${formatDate(r.expiresAt)})`),
      '',
    )
  }

  if (d.missing.length > 0) {
    sections.push(
      `<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#374151;">Missing (${d.missing.length})</p>` +
      itemTable(d.missing.map((r) => ({ name: r.staffName, itemType: r.itemType, date: null }))),
    )
    textLines.push(
      `MISSING (${d.missing.length}):`,
      ...d.missing.map((r) => `  - ${r.staffName}: ${r.itemType.replace(/_/g, ' ')}`),
      '',
    )
  }

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">
      Compliance reminders for <strong>${d.date}</strong>
    </p>
    <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">
      ${total} item${total !== 1 ? 's require' : ' requires'} attention.
    </p>
    ${sections.join('')}
    ${ctaButton('View Compliance Dashboard', d.adminLink)}
  `

  const text = [
    `CARE OS COMPLIANCE REMINDERS — ${d.date}`,
    '─'.repeat(40),
    '',
    ...textLines,
    `View compliance dashboard: ${d.adminLink}`,
    '',
    d.companyName,
  ].join('\n')

  return { subject, html: emailShell(d.companyName, subject, body), text }
}
