import 'server-only'

import { Resend } from 'resend'
import { emailConfig } from './config'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(emailConfig.apiKey)
  return _resend
}

export interface SendEmailParams {
  to:       string | string[]
  subject:  string
  html:     string
  text:     string
  from?:    string
  replyTo?: string
}

export type SendEmailResult =
  | { success: true;  id?: string }
  | { success: false; error: string }

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (!emailConfig.apiKey) {
    console.error('[sendEmail] RESEND_API_KEY is not configured')
    return { success: false, error: 'Email service not configured — RESEND_API_KEY missing' }
  }

  const from    = params.from    ?? emailConfig.from
  const replyTo = params.replyTo ?? emailConfig.replyTo

  try {
    const payload: Parameters<Resend['emails']['send']>[0] = {
      from,
      to:      params.to,
      subject: params.subject,
      html:    params.html,
      text:    params.text,
    }
    if (replyTo) payload.replyTo = replyTo

    const { data, error } = await getResend().emails.send(payload)

    if (error) {
      console.error('[sendEmail] Resend error:', error.message ?? String(error))
      return { success: false, error: error.message ?? String(error) }
    }

    return { success: true, id: data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sendEmail] unexpected error:', message)
    return { success: false, error: message }
  }
}
