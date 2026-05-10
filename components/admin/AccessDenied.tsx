// Shared "insufficient permissions" UI for protected admin pages.
// Rendered server-side — no 'use client' needed.
export default function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-4">
        <svg
          className="h-6 w-6 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-900">Access restricted</p>
      <p className="mt-1 text-sm text-gray-500">
        You do not have permission to view this page.
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Contact your administrator if you believe this is an error.
      </p>
    </div>
  )
}
