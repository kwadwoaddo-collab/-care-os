import { Suspense } from 'react'
import LoginForm from './LoginForm'

export const metadata = { title: 'Admin Login — Care OS' }

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
            Care OS
          </p>
          <h1 className="text-2xl font-semibold text-primary">Admin Login</h1>
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-6 py-8 shadow-sm">
          <Suspense fallback={<div className="h-48" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
