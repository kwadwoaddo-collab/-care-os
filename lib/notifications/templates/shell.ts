/** Shared HTML email wrapper used by all notification templates. */
export function emailShell(companyName: string, title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:#1a1a2e;padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">${companyName}</p>
          <p style="margin:4px 0 0;color:#a0aec0;font-size:12px;">Care OS Operations</p>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          ${body}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
            © ${new Date().getFullYear()} ${companyName} &mdash; Care OS automated notification
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

export function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:#6b7280;width:140px;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:500;">${value}</td>
  </tr>`
}

export function alertBox(text: string, colour: 'red' | 'amber' | 'blue'): string {
  const palette = {
    red:   { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
    amber: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
    blue:  { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
  }[colour]
  return `<table cellpadding="0" cellspacing="0" style="width:100%;background:${palette.bg};border-left:4px solid ${palette.border};border-radius:4px;margin:16px 0;">
    <tr><td style="padding:12px 16px;font-size:13px;color:${palette.text};">${text}</td></tr>
  </table>`
}

export function ctaButton(label: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background:#4f46e5;border-radius:6px;">
        <a href="${href}" style="display:inline-block;padding:12px 24px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`
}
