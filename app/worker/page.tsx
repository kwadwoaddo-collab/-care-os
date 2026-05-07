import { redirect } from 'next/navigation'

// ── Worker home ───────────────────────────────────────────────────────────────
//
// Workers access the portal via magic-link (token stored in sessionStorage by
// the login page). This server component:
//   1. Redirects to /worker/dashboard on direct navigation (no way to check
//      sessionStorage on server — the login page handles token storage).
//   2. Shows a clear "use your invite link" message if accessed without context.
//
// In practice the worker should always arrive via:
//   /worker/login?token=xxx  →  stores token  →  redirects to /worker/dashboard

export default async function WorkerHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const hasToken = Boolean(params.token)

  // If a token query param is present here (shouldn't be — login handles it),
  // redirect to login to process it properly.
  if (hasToken) {
    redirect(`/worker/login?token=${encodeURIComponent(params.token)}`)
  }

  // Otherwise show a clear landing message — the worker must use their invite link
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>

        {/* Message */}
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Worker Portal</h1>
          <p className="text-sm text-gray-500 mt-2">
            Please use your worker portal invite link to sign in.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Check your email for a link from your employer.
          </p>
        </div>

        {/* Info box */}
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 text-left">
          <p className="font-medium mb-1">Can&apos;t find your link?</p>
          <p className="text-xs text-amber-600">
            Ask your manager or HR administrator to resend your worker portal invite.
            Links expire after 90 days for security.
          </p>
        </div>
      </div>
    </div>
  )
}
