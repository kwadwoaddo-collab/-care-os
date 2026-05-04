/**
 * lib/email/resend.ts
 *
 * Server-side only — never import this from a client component.
 * The RESEND_API_KEY must stay on the server; it is never exposed to the browser.
 */

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface SendInviteEmailOptions {
  to: string
  firstName: string
  jobRole: string
  magicLink: string
  /** ISO-8601 string — derived from token_expires_at */
  expiresAt: string
}

/**
 * Sends the applicant invite email.
 *
 * Returns `{ success: true }` on success or `{ success: false, error }` on failure.
 * The caller is responsible for deciding whether to surface the error.
 */
export async function sendInviteEmail(
  opts: SendInviteEmailOptions,
): Promise<{ success: true } | { success: false; error: unknown }> {
  const { to, firstName, jobRole, magicLink, expiresAt } = opts

  const fromEmail = process.env.INVITE_FROM_EMAIL ?? 'noreply@caresupreme.com'
  const companyName = 'Care Supreme'

  const expiryDate = new Date(expiresAt).toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your ${companyName} application link</title>
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
              <p style="margin:4px 0 0;color:#a0aec0;font-size:13px;">Recruitment Portal</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi ${firstName},</p>

              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                You've been invited to apply for the <strong>${jobRole}</strong> position at
                <strong>${companyName}</strong>. Click the button below to complete your application.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin:32px 0;">
                <tr>
                  <td style="background:#4f46e5;border-radius:6px;">
                    <a href="${magicLink}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                      Start My Application →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
                Or copy this link into your browser:
              </p>
              <p style="margin:0 0 24px;font-size:12px;color:#4f46e5;word-break:break-all;">
                ${magicLink}
              </p>

              <!-- Expiry notice -->
              <table cellpadding="0" cellspacing="0" style="background:#fef9c3;border-left:4px solid #f59e0b;border-radius:4px;margin:0 0 24px;width:100%;">
                <tr>
                  <td style="padding:12px 16px;">
                    <p style="margin:0;font-size:13px;color:#92400e;">
                      ⏰ &nbsp;This link expires on <strong>${expiryDate}</strong> (7 days from now).
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
                If you weren't expecting this email, you can safely ignore it.
                No account will be created unless you complete the form.
              </p>
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
</html>
`.trim()

  const text = [
    `Hi ${firstName},`,
    '',
    `You've been invited to apply for the ${jobRole} position at ${companyName}.`,
    '',
    `Complete your application here: ${magicLink}`,
    '',
    `This link expires on ${expiryDate} (7 days from now).`,
    '',
    `If you weren't expecting this email, you can safely ignore it.`,
    '',
    `© ${new Date().getFullYear()} ${companyName}`,
  ].join('\n')

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `Your ${companyName} application link`,
      html,
      text,
    })

    if (error) {
      return { success: false, error }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err }
  }
}
