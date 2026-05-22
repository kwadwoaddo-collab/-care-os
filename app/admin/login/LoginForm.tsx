'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

export default function LoginForm() {
  const router        = useRouter()
  const searchParams  = useSearchParams()
  const callbackError = searchParams.get('error') ?? ''

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState(callbackError)
  const [loading, setLoading]   = useState(false)
  const [checking, setChecking] = useState(true)

  /**
   * CRITICAL FIX: Detect Supabase invite / recovery tokens in the URL fragment.
   *
   * When Supabase sends an invite email and the user clicks the link, Supabase
   * resolves the token and redirects to the site URL. If the site URL is set to
   * /admin/login in the Supabase dashboard (or the redirectTo was not respected),
   * the user lands here with a URL fragment like:
   *   #access_token=...&refresh_token=...&type=invite
   *
   * We detect this and forward them to /admin/set-password immediately.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return

    const hash   = window.location.hash
    const params = new URLSearchParams(hash.replace('#', ''))
    const type   = params.get('type')

    if (type === 'invite' || type === 'recovery' || type === 'signup') {
      // Preserve the full hash so set-password can exchange the token
      router.replace(`/admin/set-password${window.location.hash}`)
      return
    }

    // Check if there's already an active session — redirect to dashboard
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/admin')
      } else {
        setChecking(false)
      }
    })
  }, [router])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  // Show a spinner while checking for existing session / invite tokens
  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="w-6 h-6 rounded-full border-2 border-outline-variant border-t-secondary animate-spin" />
        <p className="text-xs text-on-surface-variant">Checking your session…</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-xs font-semibold text-on-surface mb-1.5">
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="block w-full rounded-lg border border-outline-variant px-3 py-2.5 text-sm text-primary placeholder-on-surface-variant/40 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
          placeholder="admin@yourcompany.com"
          disabled={loading}
        />
      </div>

      {/* Password */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="password" className="block text-xs font-semibold text-on-surface">
            Password
          </label>
          <a
            href="/admin/reset-password"
            className="text-[11px] text-secondary hover:underline font-medium"
            tabIndex={-1}
          >
            Forgot password?
          </a>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full rounded-lg border border-outline-variant px-3 py-2.5 pr-10 text-sm text-primary placeholder-on-surface-variant/40 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
            placeholder="••••••••"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
            tabIndex={-1}
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            <span className="material-symbols-outlined text-[18px]">
              {showPw ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 flex gap-2">
          <span className="material-symbols-outlined text-red-500 text-[16px] shrink-0 mt-0.5">error</span>
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-secondary text-on-secondary px-4 py-3 text-sm font-semibold hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Signing in…
          </span>
        ) : 'Sign in →'}
      </button>

      {/* First-time hint */}
      <div className="flex items-center gap-2 bg-surface-container rounded-lg px-3 py-2.5 mt-1">
        <span className="material-symbols-outlined text-on-surface-variant text-[16px] shrink-0">info</span>
        <p className="text-[11px] text-on-surface-variant leading-relaxed">
          <span className="font-semibold">First time?</span>{' '}
          Check your email for your admin setup link to create your password.
        </p>
      </div>
    </form>
  )
}
