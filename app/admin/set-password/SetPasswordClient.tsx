'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

// ── Password strength ─────────────────────────────────────────────────────────

function getStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8)              score++
  if (/[A-Z]/.test(pw))           score++
  if (/[0-9]/.test(pw))           score++
  if (/[^A-Za-z0-9]/.test(pw))    score++
  if (score <= 1) return { score, label: 'Weak',   color: 'bg-red-500' }
  if (score === 2) return { score, label: 'Fair',   color: 'bg-amber-500' }
  if (score === 3) return { score, label: 'Good',   color: 'bg-blue-500' }
  return              { score, label: 'Strong', color: 'bg-emerald-500' }
}

function Req({ met, label }: { met: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-[12px] transition-colors ${met ? 'text-emerald-600' : 'text-on-surface-variant'}`}>
      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 ${met ? 'bg-emerald-100 text-emerald-600' : 'bg-surface-container text-on-surface-variant/40'}`}>
        {met ? '✓' : '·'}
      </span>
      {label}
    </li>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SetPasswordClient() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const urlError     = searchParams.get('error')

  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [showCfm, setShowCfm]       = useState(false)
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState(false)

  const supabase  = createClient()
  const strength  = getStrength(password)
  const has8      = password.length >= 8
  const hasUpper  = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)

  useEffect(() => {
    async function checkSession() {
      if (urlError) {
        setError('Invitation link expired or invalid. Please ask to have a new invite sent.')
        setLoading(false)
        return
      }

      const { data: { session }, error: sessionErr } = await supabase.auth.getSession()

      if (sessionErr || !session) {
        setError('No active invitation found. Please check your email for the correct link, or ask to have a new invite sent.')
        setLoading(false)
        return
      }

      setLoading(false)
    }
    void checkSession()
  }, [supabase.auth, urlError])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!has8 || !hasUpper || !hasNumber) {
      setError('Password does not meet the requirements below.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)

    const { error: updateErr } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    })

    if (updateErr) {
      setError(updateErr.message)
      setSubmitting(false)
      return
    }

    setSuccess(true)
    setSubmitting(false)

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname)
    }

    setTimeout(() => {
      router.push('/admin')
      router.refresh()
    }, 1800)
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-outline-variant border-t-secondary animate-spin" />
        <p className="text-sm text-on-surface-variant">Verifying your invitation…</p>
      </div>
    )
  }

  // ── Success ───────────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-emerald-600 text-[28px]">check_circle</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-primary">Account activated!</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Your admin account is ready. Taking you to the dashboard…
          </p>
        </div>
        <div className="flex justify-center pt-2">
          <div className="w-5 h-5 rounded-full border-2 border-outline-variant border-t-secondary animate-spin" />
        </div>
      </div>
    )
  }

  // ── Error (invalid token) ─────────────────────────────────────────────────

  if (error && loading === false && !password) {
    return (
      <div className="space-y-5 py-4">
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex gap-3">
          <span className="material-symbols-outlined text-red-500 shrink-0 mt-0.5 text-[20px]">error</span>
          <div>
            <p className="text-sm font-semibold text-red-800">Invitation issue</p>
            <p className="text-xs text-red-600 mt-0.5 leading-relaxed">{error}</p>
          </div>
        </div>
        <p className="text-xs text-on-surface-variant text-center">
          Need help?{' '}
          <a href="mailto:support@care-os.app" className="text-secondary hover:underline font-medium">
            Contact support
          </a>
        </p>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Verified banner */}
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
        <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0">verified</span>
        <p className="text-[12px] font-semibold text-emerald-700">Invite verified — create your password below</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* New password */}
        <div>
          <label htmlFor="pass" className="block text-xs font-semibold text-on-surface mb-1.5">
            New Password
          </label>
          <div className="relative">
            <input
              id="pass"
              type={showPw ? 'text' : 'password'}
              required
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-lg border border-outline-variant px-3 py-2.5 pr-10 text-sm text-primary placeholder-on-surface-variant/40 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
              placeholder="Create a strong password"
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
              tabIndex={-1}
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              <span className="material-symbols-outlined text-[18px]">{showPw ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>

          {/* Strength bar */}
          {password.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength.score ? strength.color : 'bg-outline-variant/30'}`}
                  />
                ))}
              </div>
              <p className={`text-[11px] font-semibold ${strength.color.replace('bg-', 'text-')}`}>
                {strength.label}
              </p>
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label htmlFor="confirm" className="block text-xs font-semibold text-on-surface mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="confirm"
              type={showCfm ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={[
                'block w-full rounded-lg border px-3 py-2.5 pr-10 text-sm text-primary placeholder-on-surface-variant/40 focus:outline-none focus:ring-2 transition-all',
                confirm.length > 0 && password !== confirm
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
                  : confirm.length > 0 && password === confirm
                  ? 'border-emerald-400 focus:border-emerald-400 focus:ring-emerald-200'
                  : 'border-outline-variant focus:border-secondary focus:ring-secondary/20',
              ].join(' ')}
              placeholder="Re-enter your password"
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => setShowCfm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
              tabIndex={-1}
              aria-label={showCfm ? 'Hide password' : 'Show password'}
            >
              <span className="material-symbols-outlined text-[18px]">{showCfm ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
        </div>

        {/* Requirements */}
        <ul className="grid grid-cols-1 gap-1.5 pt-1">
          <Req met={has8}      label="At least 8 characters" />
          <Req met={hasUpper}  label="One uppercase letter" />
          <Req met={hasNumber} label="One number" />
          {confirm.length > 0 && (
            <Req met={password === confirm} label="Passwords match" />
          )}
        </ul>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 flex gap-2">
            <span className="material-symbols-outlined text-red-500 text-[16px] shrink-0 mt-0.5">error</span>
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !has8 || !hasUpper || !hasNumber || password !== confirm}
          className="w-full rounded-lg bg-secondary text-on-secondary px-4 py-3 text-sm font-semibold hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Activating…
            </span>
          ) : 'Activate My Account →'}
        </button>
      </form>

      <p className="text-center text-[11px] text-on-surface-variant/60 pt-1">
        This is a one-time setup. You'll sign in with your email &amp; password after this.
      </p>
    </div>
  )
}
