import { emailShell, alertBox, ctaButton } from './shell'

export interface ComplianceMissingItem {
  staffName: string
  staffId:   string
  itemType:  string
}

export interface ComplianceMissingData {
  companyName: string
  items:       ComplianceMissingItem[]
  adminLink:   string
}

export function complianceMissingTemplate(
  d: ComplianceMissingData,
): { subject: string; html: string; text: string } {
  const subject = `📋 Compliance documents missing (${d.items.length} item${d.items.length !== 1 ? 's' : ''})`

  const itemRows = d.items
    .map(
      (item) => `<tr>
        <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;">${item.staffName}</td>
        <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;color:#374151;">${item.itemType.replace(/_/g, ' ')}</td>
      </tr>`,
    )
    .join('')

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Compliance documents are missing</p>
    ${alertBox(
      `${d.items.length} compliance item${d.items.length !== 1 ? 's have' : ' has'} not been started. Evidence must be submitted to maintain compliant staff records.`,
      'amber',
    )}
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px;font-size:12px;text-align:left;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Staff member</th>
          <th style="padding:8px 12px;font-size:12px;text-align:left;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Missing item</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <p style="margin:16px 0;font-size:13px;color:#6b7280;line-height:1.5;">
      Please collect and upload the missing documentation at your earliest opportunity.
    </p>
    ${ctaButton('View Compliance', d.adminLink)}
  `

  const textItems = d.items
    .map((i) => `  - ${i.staffName}: ${i.itemType.replace(/_/g, ' ')}`)
    .join('\n')

  const text = [
    `COMPLIANCE DOCUMENTS MISSING`,
    '',
    textItems,
    '',
    `Please arrange to collect and upload the missing documentation.`,
    '',
    `View compliance dashboard: ${d.adminLink}`,
    '',
    d.companyName,
  ].join('\n')

  return { subject, html: emailShell(d.companyName, subject, body), text }
}
