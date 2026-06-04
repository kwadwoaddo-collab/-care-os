import { Suspense } from 'react'
import ApplyContent from './ApplyContent'

export const metadata = {
  title: 'Join Care Supreme — Secure Application Portal',
  description: 'Apply to join the Care Supreme team. Your application is secure, encrypted, and auto-saved.',
}

function LoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      <p className="text-sm font-jakarta">Verifying your invitation…</p>
    </div>
  )
}

export default function ApplyPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Branded header bar */}
      <header className="bg-gradient-to-r from-indigo-700 to-violet-700 text-white px-6 py-4 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">🛡️</span>
          <div>
            <p className="text-base font-bold tracking-tight leading-none" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
              Care Supreme
            </p>
            <p className="text-xs text-indigo-200 mt-0.5">Secure Application Portal</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-2xl space-y-6">

          {/* Welcome card */}
          <div className="bg-gradient-to-b from-indigo-50 to-white border border-indigo-100 rounded-2xl p-6 shadow-sm">
            <h1
              className="text-xl font-bold text-gray-900 mb-1"
              style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
            >
              Welcome to Care Supreme
            </h1>
            <p className="text-sm text-gray-600 mb-4">
              You&apos;ve been invited to apply for a role with us. Complete the form below — your progress is saved automatically as you go.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-indigo-100 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
                🔒 Secure &amp; encrypted
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-indigo-100 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
                💾 Auto-saved
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-indigo-100 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
                ✅ CQC compliant
              </span>
            </div>
          </div>

          {/* Application form */}
          <Suspense fallback={<LoadingFallback />}>
            <ApplyContent />
          </Suspense>

        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-5 border-t border-gray-100">
        Care Supreme &copy; 2025 &middot; Confidential Application
      </footer>
    </div>
  )
}
