import { emailShell, alertBox, ctaButton } from './shell'

export interface ComplianceExpiredItem {
  staffName:    string
  staffId:      string
  itemType:     string
  expiredOn:    string  // formatted date string
}

export interface ComplianceExpiredData {
  companyName: string
  items:       ComplianceExpiredItem[]
  adminLink:   string
}

export function complianceExpiredTemplate(
  d: ComplianceExpiredData,
): { subject: string; html: string; text: string } {
  const subject = `🚨 Compliance documents expired (${d.items.length} item${d.items.length !== 1 ? 's' : ''})`

  const itemRows = d.items
    .map(
      (item) => `<tr>
        <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;">${item.staffName}</td>
        <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;">${item.itemType.replace(/_/g, ' ')}</td>
        <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;color:#dc2626;font-weight:600;">${item.expiredOn}</td>
      </tr>`,
    )
    .join('')

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Compliance documents have expired</p>
    ${alertBox(
      `${d.items.length} compliance document${d.items.length !== 1 ? 's have' : ' has'} expired and require immediate action.`,
      'red',
    )}
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr style="background:#fef2f2;">
          <th style="padding:8px 12px;font-size:12px;text-align:left;color:#991b1b;text-transform:uppercase;letter-spacing:0.05em;">Staff member</th>
          <th style="padding:8px 12px;font-size:12px;text-align:left;color:#991b1b;text-transform:uppercase;letter-spacing:0.05em;">Document</th>
          <th style="padding:8px 12px;font-size:12px;text-align:left;color:#991b1b;text-transform:uppercase;letter-spacing:0.05em;">Expired on</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <p style="margin:16px 0;font-size:13px;color:#6b7280;line-height:1.5;">
      Expired documents put your CQC compliance at risk.
      Please arrange renewals as soon as possible and upload the updated documents.
    </p>
    ${ctaButton('View Compliance', d.adminLink)}
  `

  const textItems = d.items
    .map((i) => `  - ${i.staffName}: ${i.itemType.replace(/_/g, ' ')} (expired ${i.expiredOn})`)
    .join('\n')

  const text = [
    `COMPLIANCE DOCUMENTS EXPIRED`,
    '',
    textItems,
    '',
    `These documents require immediate renewal to maintain CQC compliance.`,
    '',
    `View compliance dashboard: ${d.adminLink}`,
    '',
    d.companyName,
  ].join('\n')

  return { subject, html: emailShell(d.companyName, subject, body), text }
}
