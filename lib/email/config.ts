import 'server-only'

export const emailConfig = {
  apiKey:  process.env.RESEND_API_KEY ?? '',
  from:    process.env.EMAIL_FROM ?? process.env.INVITE_FROM_EMAIL ?? 'Care OS <notifications@care.sprintscaleit.co.uk>',
  replyTo: process.env.EMAIL_REPLY_TO,
  appUrl:  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
} as const

export function isEmailConfigured(): boolean {
  return emailConfig.apiKey.length > 10
}

export function isEmailFromConfigured(): boolean {
  return Boolean(process.env.EMAIL_FROM ?? process.env.INVITE_FROM_EMAIL)
}
