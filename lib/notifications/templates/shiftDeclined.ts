import { emailShell, row, alertBox, ctaButton } from './shell'

export interface ShiftDeclinedData {
  companyName:  string
  workerName:   string
  shiftTitle:   string
  shiftDate:    string
  startTime:    string
  clientName:   string | null
  reason:       string | null
  adminLink:    string
}

export function shiftDeclinedTemplate(d: ShiftDeclinedData): { subject: string; html: string; text: string } {
  const subject = `⚠ Shift declined: ${d.shiftTitle} on ${d.shiftDate}`

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Shift declined by worker</p>
    ${alertBox(`<strong>${d.workerName}</strong> has declined a shift. You may need to find a replacement.`, 'red')}
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0 20px;">
      ${row('Shift',  d.shiftTitle)}
      ${row('Date',   d.shiftDate)}
      ${row('Time',   d.startTime)}
      ${row('Client', d.clientName ?? '—')}
      ${row('Worker', d.workerName)}
      ${d.reason ? row('Reason', `<em>${d.reason}</em>`) : ''}
    </table>
    ${ctaButton('Manage in Shift Ops', d.adminLink)}
  `

  const text = [
    `SHIFT DECLINED — Action required`,
    '',
    `${d.workerName} has declined: ${d.shiftTitle}`,
    `Date: ${d.shiftDate} at ${d.startTime}`,
    `Client: ${d.clientName ?? '—'}`,
    d.reason ? `Reason: ${d.reason}` : '',
    '',
    `Manage in Shift Ops: ${d.adminLink}`,
    '',
    `${d.companyName}`,
  ].filter((l) => l !== undefined).join('\n')

  return { subject, html: emailShell(d.companyName, subject, body), text }
}
