import { Suspense } from 'react'
import LoginForm from './LoginForm'

export const metadata = {
  title: 'Admin Login — Care OS',
  description: 'Sign in to your Care OS admin dashboard',
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-surface-container-low flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Branding */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary mb-3">
            <span className="material-symbols-outlined text-white text-[22px]">admin_panel_settings</span>
          </div>
          <h1 className="text-2xl font-bold text-primary" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
            Welcome back
          </h1>
          <p className="text-sm text-on-surface-variant">Sign in to your admin dashboard</p>
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-[0_4px_24px_-2px_rgba(0,0,0,0.08)] px-6 py-7">
          <Suspense fallback={<div className="h-56 flex items-center justify-center"><div className="w-5 h-5 rounded-full border-2 border-outline-variant border-t-secondary animate-spin" /></div>}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-[11px] text-on-surface-variant/50">
          Care OS · Healthcare Admin Platform
        </p>
      </div>
    </div>
  )
}
