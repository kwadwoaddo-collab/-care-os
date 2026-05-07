import { emailShell, row, alertBox, ctaButton } from './shell'

export interface RunningLateData {
  companyName:  string
  workerName:   string
  shiftTitle:   string
  shiftDate:    string
  startTime:    string
  clientName:   string | null
  reason:       string | null
  adminLink:    string
}

export function runningLateTemplate(d: RunningLateData): { subject: string; html: string; text: string } {
  const subject = `⏱ Worker running late: ${d.shiftTitle}`

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Worker running late</p>
    ${alertBox(`<strong>${d.workerName}</strong> has reported they are running late for today's shift.`, 'amber')}
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0 20px;">
      ${row('Shift',        d.shiftTitle)}
      ${row('Date',         d.shiftDate)}
      ${row('Start time',   d.startTime)}
      ${row('Client',       d.clientName ?? '—')}
      ${row('Worker',       d.workerName)}
      ${d.reason ? row('Message', `<em>${d.reason}</em>`) : ''}
    </table>
    ${ctaButton('View in Shift Ops', d.adminLink)}
    <p style="margin:0;font-size:12px;color:#9ca3af;">
      You may want to notify the client or make alternative arrangements.
    </p>
  `

  const text = [
    `WORKER RUNNING LATE`,
    '',
    `${d.workerName} is running late for: ${d.shiftTitle}`,
    `Date: ${d.shiftDate} at ${d.startTime}`,
    `Client: ${d.clientName ?? '—'}`,
    d.reason ? `Message: ${d.reason}` : '',
    '',
    `View in Shift Ops: ${d.adminLink}`,
    '',
    `${d.companyName}`,
  ].filter((l) => l !== undefined).join('\n')

  return { subject, html: emailShell(d.companyName, subject, body), text }
}
