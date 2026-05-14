/**
 * lib/email/resend.ts
 *
 * Server-side only — never import this from a client component.
 * Company name is now dynamic (fetched from companies table / passed as param).
 * Fallback: 'Care OS'
 */

import 'server-only'
import { sendEmail, type SendEmailResult } from './sendEmail'
import { emailConfig }                     from './config'

// ── Shared helpers ────────────────────────────────────────────────────────────

const DEFAULT_COMPANY = 'Care OS'

function safeCompanyName(name: string | null | undefined): string {
  return name?.trim() || DEFAULT_COMPANY
}

function formatExpiryDate(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString('en-GB', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  })
}

function emailWrapper(companyName: string, subtitle: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${companyName}</h1>
              <p style="margin:4px 0 0;color:#a0aec0;font-size:13px;">${subtitle}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                © ${new Date().getFullYear()} ${companyName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()
}

function ctaButton(href: string, label: string): string {
  return `
<table cellpadding="0" cellspacing="0" style="margin:32px 0;">
  <tr>
    <td style="background:#4f46e5;border-radius:6px;">
      <a href="${href}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${label}</a>
    </td>
  </tr>
</table>`
}

function expiryNotice(expiryDate: string): string {
  return `
<table cellpadding="0" cellspacing="0" style="background:#fef9c3;border-left:4px solid #f59e0b;border-radius:4px;margin:0 0 24px;width:100%;">
  <tr>
    <td style="padding:12px 16px;">
      <p style="margin:0;font-size:13px;color:#92400e;">
        ⏰ &nbsp;This link expires on <strong>${expiryDate}</strong>.
      </p>
    </td>
  </tr>
</table>`
}

// ── Invitation email (applicant) ──────────────────────────────────────────────

export interface SendInviteEmailOptions {
  to:          string
  firstName:   string
  jobRole:     string
  magicLink:   string
  expiresAt:   string
  companyName?: string | null
}

export async function sendInviteEmail(
  opts: SendInviteEmailOptions,
): Promise<SendEmailResult> {
  const { to, firstName, jobRole, magicLink, expiresAt } = opts
  const companyName = safeCompanyName(opts.companyName)
  const expiryDate  = formatExpiryDate(expiresAt)

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi ${firstName},</p>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      You've been invited to apply for the <strong>${jobRole}</strong> position at
      <strong>${companyName}</strong>. Click the button below to complete your application.
    </p>
    ${ctaButton(magicLink, 'Start My Application →')}
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Or copy this link into your browser:</p>
    <p style="margin:0 0 24px;font-size:12px;color:#4f46e5;word-break:break-all;">${magicLink}</p>
    ${expiryNotice(expiryDate)}
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
      If you weren't expecting this email, you can safely ignore it.
      No account will be created unless you complete the form.
    </p>`

  const html = emailWrapper(companyName, 'Recruitment Portal', body)
  const text = [
    `Hi ${firstName},`,
    '',
    `You've been invited to apply for the ${jobRole} position at ${companyName}.`,
    '',
    `Complete your application here: ${magicLink}`,
    '',
    `This link expires on ${expiryDate}.`,
    '',
    `If you weren't expecting this email, you can safely ignore it.`,
    '',
    `© ${new Date().getFullYear()} ${companyName}`,
  ].join('\n')

  return sendEmail({ to, subject: `Your ${companyName} application link`, html, text })
}

// ── Worker portal email ───────────────────────────────────────────────────────

export interface SendWorkerPortalEmailOptions {
  to:          string
  firstName:   string
  jobRole:     string
  magicLink:   string
  expiresAt:   string
  companyName?: string | null
}

export async function sendWorkerPortalEmail(
  opts: SendWorkerPortalEmailOptions,
): Promise<SendEmailResult> {
  const { to, firstName, jobRole, magicLink, expiresAt } = opts
  const companyName = safeCompanyName(opts.companyName)
  const expiryDate  = formatExpiryDate(expiresAt)

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi ${firstName},</p>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      You have been given access to the <strong>${companyName} Staff Portal</strong> for your
      <strong>${jobRole}</strong> role. Use the password-less magic link below to instantly and securely log into your portal.
    </p>
    ${ctaButton(magicLink, 'Access My Portal →')}
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Or copy this link:</p>
    <p style="margin:0 0 24px;font-size:12px;color:#4f46e5;word-break:break-all;">${magicLink}</p>
    ${expiryNotice(expiryDate)}
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
      If you were not expecting this email, you can safely ignore it.
    </p>`

  const html = emailWrapper(companyName, 'Staff Portal', body)
  const text = [
    `Hi ${firstName},`,
    '',
    `You have been given access to the ${companyName} Staff Portal for your ${jobRole} role.`,
    '',
    `Access your portal here: ${magicLink}`,
    '',
    `This link expires on ${expiryDate}.`,
    '',
    `If you were not expecting this email, you can safely ignore it.`,
    '',
    `© ${new Date().getFullYear()} ${companyName}`,
  ].join('\n')

  return sendEmail({ to, subject: `Your ${companyName} staff portal access`, html, text })
}

// ── Admin portal email ────────────────────────────────────────────────────────

export interface SendAdminInviteEmailOptions {
  to:          string
  firstName:   string
  inviteLink:  string
  companyName?: string | null
}

export async function sendAdminInviteEmail(
  opts: SendAdminInviteEmailOptions,
): Promise<SendEmailResult> {
  const { to, firstName, inviteLink } = opts
  const companyName = safeCompanyName(opts.companyName)

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi ${firstName},</p>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      You have been granted Administrative Access to the <strong>${companyName} Admin Portal</strong>. 
      Please use the link below to securely set up your password and log into the admin dashboard.
    </p>
    ${ctaButton(inviteLink, 'Set Up Admin Password →')}
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Or copy this link:</p>
    <p style="margin:0 0 24px;font-size:12px;color:#4f46e5;word-break:break-all;">${inviteLink}</p>
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
      If you were not expecting this email, you can safely ignore it.
    </p>`

  const html = emailWrapper(companyName, 'Admin Portal', body)
  const text = [
    `Hi ${firstName},`,
    '',
    `You have been granted Administrative Access to the ${companyName} Admin Portal.`,
    '',
    `Set up your admin password here: ${inviteLink}`,
    '',
    `If you were not expecting this email, you can safely ignore it.`,
    '',
    `© ${new Date().getFullYear()} ${companyName}`,
  ].join('\n')

  return sendEmail({ to, subject: `Set up your ${companyName} Admin Password`, html, text })
}

// ── Onboarding reminder email ─────────────────────────────────────────────────

export interface SendOnboardingReminderEmailOptions {
  to:            string
  firstName:     string
  portalLink:    string
  missingItems:  string[]
  companyName?:  string | null
}

export async function sendOnboardingReminderEmail(
  opts: SendOnboardingReminderEmailOptions,
): Promise<SendEmailResult> {
  const { to, firstName, portalLink, missingItems } = opts
  const companyName = safeCompanyName(opts.companyName)

  const missingList = missingItems.length > 0
    ? `<ul style="margin:8px 0 16px;padding-left:20px;font-size:14px;color:#374151;line-height:1.8;">
         ${missingItems.map((item) => `<li>${item}</li>`).join('')}
       </ul>`
    : ''

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi ${firstName},</p>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      Your onboarding with <strong>${companyName}</strong> is not yet complete.
      Please log in to your staff portal to finish the remaining steps.
    </p>
    ${missingList ? `<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#374151;">Outstanding items:</p>${missingList}` : ''}
    ${ctaButton(portalLink, 'Complete My Onboarding →')}
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
      If you have any questions, please contact your HR team.
    </p>`

  const html = emailWrapper(companyName, 'Onboarding Reminder', body)
  const text = [
    `Hi ${firstName},`,
    '',
    `Your onboarding with ${companyName} is not yet complete.`,
    '',
    missingItems.length > 0 ? `Outstanding items:\n${missingItems.map((i) => `- ${i}`).join('\n')}` : '',
    '',
    `Complete your onboarding here: ${portalLink}`,
    '',
    `© ${new Date().getFullYear()} ${companyName}`,
  ].filter((l) => l !== undefined).join('\n')

  return sendEmail({ to, subject: `Action required: Complete your ${companyName} onboarding`, html, text })
}

// ── Onboarding complete (worker) ──────────────────────────────────────────────

export interface SendOnboardingCompleteEmailOptions {
  to:           string
  firstName:    string
  portalLink:   string
  companyName?: string | null
}

export async function sendOnboardingCompleteEmail(
  opts: SendOnboardingCompleteEmailOptions,
): Promise<SendEmailResult> {
  const { to, firstName, portalLink } = opts
  const companyName = safeCompanyName(opts.companyName)

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi ${firstName},</p>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      Great news — your onboarding with <strong>${companyName}</strong> is now complete!
      You are now fully set up in our system.
    </p>
    <table cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:4px;margin:0 0 24px;width:100%;">
      <tr>
        <td style="padding:12px 16px;">
          <p style="margin:0;font-size:14px;color:#14532d;font-weight:600;">
            ✓ Your profile is active and ready.
          </p>
        </td>
      </tr>
    </table>
    ${ctaButton(portalLink, 'View My Portal →')}
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
      If you have any questions, please contact your HR team.
    </p>`

  const html = emailWrapper(companyName, 'Staff Portal', body)
  const text = [
    `Hi ${firstName},`,
    '',
    `Your onboarding with ${companyName} is now complete! You are fully set up.`,
    '',
    `View your portal here: ${portalLink}`,
    '',
    `© ${new Date().getFullYear()} ${companyName}`,
  ].join('\n')

  return sendEmail({ to, subject: `Welcome to ${companyName} — your onboarding is complete`, html, text })
}

// ── Admin: ready for review notification ─────────────────────────────────────

export interface SendAdminReviewRequestEmailOptions {
  to:           string
  workerName:   string
  staffProfileUrl: string
  companyName?: string | null
}

export async function sendAdminReviewRequestEmail(
  opts: SendAdminReviewRequestEmailOptions,
): Promise<SendEmailResult> {
  const { to, workerName, staffProfileUrl } = opts
  const companyName = safeCompanyName(opts.companyName)

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      <strong>${workerName}</strong> has completed all onboarding tasks and is ready for your review.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;">
      Please review their uploaded documents and mark their profile as active when everything is in order.
    </p>
    ${ctaButton(staffProfileUrl, 'Review Staff Profile →')}
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
      This notification was sent automatically by ${companyName}.
    </p>`

  const html = emailWrapper(companyName, 'Admin Notification', body)
  const text = [
    `${workerName} has completed all onboarding tasks and is ready for your review.`,
    '',
    `Review their profile: ${staffProfileUrl}`,
    '',
    `© ${new Date().getFullYear()} ${companyName}`,
  ].join('\n')

  return sendEmail({ to, subject: `${workerName} is ready for onboarding review`, html, text })
}

// Re-export appUrl for any callers that need it
export const appUrl = emailConfig.appUrl
