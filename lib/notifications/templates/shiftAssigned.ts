import { emailShell, row, ctaButton } from './shell'

export interface ShiftAssignedData {
  companyName:  string
  workerName:   string
  shiftTitle:   string
  shiftDate:    string
  startTime:    string
  endTime:      string
  clientName:   string | null
  location:     string | null
  portalLink:   string
}

export function shiftAssignedTemplate(d: ShiftAssignedData): { subject: string; html: string; text: string } {
  const subject = `New shift assigned: ${d.shiftTitle} on ${d.shiftDate}`

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi ${d.workerName},</p>
    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
      You have been assigned a new shift. Please log in to the portal to accept or decline.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      ${row('Shift',    d.shiftTitle)}
      ${row('Date',     d.shiftDate)}
      ${row('Time',     `${d.startTime} – ${d.endTime}`)}
      ${row('Client',   d.clientName ?? '—')}
      ${row('Location', d.location   ?? '—')}
    </table>
    ${ctaButton('View My Shift', d.portalLink)}
    <p style="margin:0;font-size:12px;color:#9ca3af;">
      Please respond to this shift as soon as possible so your coordinator can plan effectively.
    </p>
  `

  const text = [
    `Hi ${d.workerName},`,
    '',
    `You have been assigned a new shift: ${d.shiftTitle}`,
    `Date: ${d.shiftDate}`,
    `Time: ${d.startTime} – ${d.endTime}`,
    `Client: ${d.clientName ?? '—'}`,
    `Location: ${d.location ?? '—'}`,
    '',
    `View your shift: ${d.portalLink}`,
    '',
    `Please respond to this shift as soon as possible.`,
    '',
    `${d.companyName}`,
  ].join('\n')

  return { subject, html: emailShell(d.companyName, subject, body), text }
}
