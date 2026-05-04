import { Suspense } from 'react'
import ApplyContent from './ApplyContent'

export const metadata = {
  title: 'Your Application — Care OS',
}

function LoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      <p className="text-sm">Verifying your invitation…</p>
    </div>
  )
}

export default function ApplyPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-start px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <span className="text-xl font-bold tracking-tight text-gray-900">Care OS</span>
        </div>

        <Suspense fallback={<LoadingFallback />}>
          <ApplyContent />
        </Suspense>
      </div>
    </main>
  )
}
