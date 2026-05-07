import { emailShell, ctaButton } from './shell'

export interface DigestShift {
  title:      string
  time:       string
  clientName: string | null
  staffName:  string | null
  status:     string
  ackStatus:  string | null
}

export interface DailyDigestData {
  companyName:        string
  date:               string
  totalShifts:        number
  unassignedShifts:   number
  declinedShifts:     number
  runningLate:        number
  draftNotes:         number
  openIncidents:      number
  hrIncomplete:       number
  shifts:             DigestShift[]
  adminLink:          string
}

function statCell(count: number, label: string, urgent: boolean): string {
  const colour = urgent && count > 0 ? '#dc2626' : count > 0 ? '#374151' : '#9ca3af'
  return `<td style="text-align:center;padding:12px 8px;">
    <p style="margin:0;font-size:24px;font-weight:700;color:${colour};">${count}</p>
    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;">${label}</p>
  </td>`
}

export function dailyDigestTemplate(d: DailyDigestData): { subject: string; html: string; text: string } {
  const subject = `Care OS Daily Digest — ${d.date}`

  const urgentItems = [
    d.unassignedShifts > 0 && `${d.unassignedShifts} unassigned shift${d.unassignedShifts !== 1 ? 's' : ''}`,
    d.declinedShifts   > 0 && `${d.declinedShifts} declined`,
    d.runningLate      > 0 && `${d.runningLate} running late`,
    d.openIncidents    > 0 && `${d.openIncidents} open incident${d.openIncidents !== 1 ? 's' : ''}`,
  ].filter(Boolean) as string[]

  const urgentBanner = urgentItems.length > 0
    ? `<table cellpadding="0" cellspacing="0" style="width:100%;background:#fef2f2;border-left:4px solid #fca5a5;border-radius:4px;margin:0 0 20px;">
        <tr><td style="padding:12px 16px;font-size:13px;color:#991b1b;">
          <strong>Action required:</strong> ${urgentItems.join(' · ')}
        </td></tr>
      </table>`
    : ''

  const shiftRows = d.shifts.slice(0, 10).map((s) => {
    const ackCls = s.ackStatus === 'declined' ? '#dc2626' : s.ackStatus === 'running_late' ? '#d97706' : '#6b7280'
    const ackLabel = s.ackStatus?.replace(/_/g, ' ') ?? (s.staffName ? 'no response' : '—')
    return `<tr>
      <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;">${s.time}</td>
      <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;">${s.title}</td>
      <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;">${s.clientName ?? '—'}</td>
      <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;">${s.staffName ?? '<span style="color:#d97706">Unassigned</span>'}</td>
      <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;color:${ackCls};">${ackLabel}</td>
    </tr>`
  }).join('')

  const body = `
    <p style="margin:0 0 20px;font-size:16px;color:#374151;">Daily operations summary for <strong>${d.date}</strong></p>

    ${urgentBanner}

    <!-- Stats grid -->
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border-radius:8px;margin:0 0 24px;">
      <tr>
        ${statCell(d.totalShifts,      'Shifts today',     false)}
        ${statCell(d.unassignedShifts, 'Unassigned',       true)}
        ${statCell(d.declinedShifts,   'Declined',         true)}
        ${statCell(d.openIncidents,    'Open incidents',   true)}
        ${statCell(d.hrIncomplete,     'HR incomplete',    false)}
      </tr>
    </table>

    ${d.shifts.length > 0 ? `
    <!-- Today's shifts -->
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Today's Shifts</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px;font-size:11px;text-align:left;color:#6b7280;text-transform:uppercase;">Time</th>
          <th style="padding:8px 12px;font-size:11px;text-align:left;color:#6b7280;text-transform:uppercase;">Shift</th>
          <th style="padding:8px 12px;font-size:11px;text-align:left;color:#6b7280;text-transform:uppercase;">Client</th>
          <th style="padding:8px 12px;font-size:11px;text-align:left;color:#6b7280;text-transform:uppercase;">Worker</th>
          <th style="padding:8px 12px;font-size:11px;text-align:left;color:#6b7280;text-transform:uppercase;">Response</th>
        </tr>
      </thead>
      <tbody>${shiftRows}</tbody>
    </table>
    ` : '<p style="font-size:13px;color:#9ca3af;">No shifts scheduled today.</p>'}

    ${ctaButton('Open Care OS Dashboard', d.adminLink)}
  `

  const text = [
    `CARE OS DAILY DIGEST — ${d.date}`,
    '─'.repeat(40),
    '',
    `Shifts today:     ${d.totalShifts}`,
    `Unassigned:       ${d.unassignedShifts}`,
    `Declined:         ${d.declinedShifts}`,
    `Running late:     ${d.runningLate}`,
    `Draft notes:      ${d.draftNotes}`,
    `Open incidents:   ${d.openIncidents}`,
    `HR incomplete:    ${d.hrIncomplete}`,
    '',
    urgentItems.length > 0 ? `ACTION REQUIRED: ${urgentItems.join(' · ')}` : 'No urgent actions.',
    '',
    `View dashboard: ${d.adminLink}`,
    '',
    `${d.companyName}`,
  ].join('\n')

  return { subject, html: emailShell(d.companyName, subject, body), text }
}
