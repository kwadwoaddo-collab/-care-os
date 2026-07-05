import { emailShell, alertBox, ctaButton } from './shell'

export interface ComplianceExpiringItem {
  staffName:    string
  staffId:      string
  documentType: string
  expiryDate:   string
}

export interface ComplianceExpiringData {
  companyName: string
  items:       ComplianceExpiringItem[]
  adminLink:   string
}

export function complianceExpiringTemplate(d: ComplianceExpiringData): { subject: string; html: string; text: string } {
  const subject = `⚠ Compliance documents expiring soon (${d.items.length} item${d.items.length !== 1 ? 's' : ''})`

  const itemRows = d.items.map((item) =>
    `<tr>
      <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;">${item.staffName}</td>
      <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;">${item.documentType.replace(/_/g, ' ')}</td>
      <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;color:#d97706;font-weight:600;">${item.expiryDate}</td>
    </tr>`
  ).join('')

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Compliance documents expiring soon</p>
    ${alertBox(`${d.items.length} compliance document${d.items.length !== 1 ? 's are' : ' is'} expiring within 30 days.`, 'amber')}
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px;font-size:12px;text-align:left;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Staff member</th>
          <th style="padding:8px 12px;font-size:12px;text-align:left;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Document</th>
          <th style="padding:8px 12px;font-size:12px;text-align:left;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Expiry date</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    ${ctaButton('View Compliance', d.adminLink)}
  `

  const textItems = d.items.map((i) => `  - ${i.staffName}: ${i.documentType.replace(/_/g, ' ')} (expires ${i.expiryDate})`).join('\n')

  const text = [
    `COMPLIANCE DOCUMENTS EXPIRING SOON`,
    '',
    textItems,
    '',
    `View compliance dashboard: ${d.adminLink}`,
    '',
    `${d.companyName}`,
  ].join('\n')

  return { subject, html: emailShell(d.companyName, subject, body), text }
}
