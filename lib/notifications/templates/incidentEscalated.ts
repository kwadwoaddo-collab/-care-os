import { emailShell, row, alertBox, ctaButton } from './shell'

export interface IncidentEscalatedData {
  companyName:    string
  incidentType:   string
  severity:       string
  description:    string
  clientName:     string | null
  workerName:     string | null
  occurredAt:     string
  adminLink:      string
}

export function incidentEscalatedTemplate(d: IncidentEscalatedData): { subject: string; html: string; text: string } {
  const severityLabel = d.severity.charAt(0).toUpperCase() + d.severity.slice(1)
  const subject = `🚨 ${severityLabel} incident reported: ${d.incidentType.replace(/_/g, ' ')}`

  const colour = d.severity === 'critical' || d.severity === 'high' ? 'red' as const : 'amber' as const

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Incident reported</p>
    ${alertBox(`A <strong>${severityLabel}</strong> incident has been reported and requires your attention.`, colour)}
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0 20px;">
      ${row('Type',        d.incidentType.replace(/_/g, ' '))}
      ${row('Severity',    severityLabel)}
      ${row('Occurred',    d.occurredAt)}
      ${row('Client',      d.clientName ?? '—')}
      ${row('Worker',      d.workerName ?? '—')}
    </table>
    <p style="margin:0 0 16px;font-size:13px;color:#374151;line-height:1.6;">
      <strong>Description:</strong><br />${d.description}
    </p>
    ${ctaButton('View Incident', d.adminLink)}
  `

  const text = [
    `INCIDENT REPORTED — ${severityLabel.toUpperCase()}`,
    '',
    `Type: ${d.incidentType.replace(/_/g, ' ')}`,
    `Severity: ${severityLabel}`,
    `Occurred: ${d.occurredAt}`,
    `Client: ${d.clientName ?? '—'}`,
    `Worker: ${d.workerName ?? '—'}`,
    '',
    `Description: ${d.description}`,
    '',
    `View incident: ${d.adminLink}`,
    '',
    `${d.companyName}`,
  ].join('\n')

  return { subject, html: emailShell(d.companyName, subject, body), text }
}
