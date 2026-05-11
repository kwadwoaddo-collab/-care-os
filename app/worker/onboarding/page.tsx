'use client'

/**
 * Worker Onboarding Page
 *
 * Mobile-first guided checklist to help new workers complete their onboarding.
 * Shows both worker-actionable tasks AND admin-pending items (read-only),
 * so workers understand exactly why they may be blocked.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkerDoc {
  id:              string
  document_type:   string
  file_name:       string
  expiry_date:     string | null
  created_at:      string
  reviewed_status: string | null
}

interface OnboardingSections {
  personal:    boolean
  address:     boolean
  emergency:   boolean
  hmrc:        boolean
  banking:     boolean
  employment:  boolean
  compliance:  boolean
  documents:   boolean
  policy:      boolean
}

interface OnboardingStatus {
  ready:         boolean
  progress:      number
  payroll_ready: boolean
  stage:         'not_started' | 'in_progress' | 'awaiting_review' | 'complete'
  missing:       string[]
  sections:      OnboardingSections
  checks:        Record<string, boolean>
}

interface Profile {
  id:                  string
  first_name:          string | null
  last_name:           string | null
  email:               string | null
  status:              string
  policy_acknowledged: boolean | null
}

interface OnboardingData {
  profile:     Profile
  status:      OnboardingStatus
  nextActions: { id: string; label: string; section: string; urgent: boolean }[]
  documents:   WorkerDoc[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  personal:    'Personal Details',
  address:     'Home Address',
  emergency:   'Emergency Contact',
  documents:   'Documents',
  policy:      'Company Policies',
  hmrc:        'Payroll & HMRC',
  banking:     'Bank Details',
  employment:  'Employment Details',
  compliance:  'Compliance Checks',
}

const SECTION_DESCS: Record<string, string> = {
  personal:    'Full name, date of birth, nationality',
  address:     'Current home address and postcode',
  emergency:   'Name and phone number of emergency contact',
  documents:   'Passport, DBS certificate, right to work, proof of address',
  policy:      'Acknowledge company policies and procedures',
  hmrc:        'NI number and starter declaration',
  banking:     'Bank account details for payroll',
  employment:  'Contract type and hours',
  compliance:  'Right to work check and DBS (completed by admin)',
}

// Sections worker can act on themselves (vs admin-only)
const WORKER_SECTIONS = new Set(['personal', 'address', 'emergency', 'documents', 'policy'])
const ADMIN_SECTIONS  = new Set(['hmrc', 'banking', 'employment', 'compliance'])

// Progress ring component
function ProgressRing({ pct }: { pct: number }) {
  const r  = 40
  const c  = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  const color = pct === 100 ? '#16a34a' : pct >= 60 ? '#4f46e5' : '#f59e0b'

  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="transform -rotate-90">
      <circle cx="48" cy="48" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle
        cx="48" cy="48" r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  )
}

// ── Step row ─────────────────────────────────────────────────────────────────

function StepRow({
  label,
  description,
  done,
  adminOnly,
  workerAction,
}: {
  label:        string
  description:  string
  done:         boolean
  adminOnly:    boolean
  workerAction?: React.ReactNode
}) {
  const icon = done
    ? '✓'
    : adminOnly
    ? '⏳'
    : '○'

  const iconCls = done
    ? 'bg-green-100 text-green-700'
    : adminOnly
    ? 'bg-amber-50 text-amber-600'
    : 'bg-gray-100 text-gray-400'

  const rowCls = done
    ? 'border-green-100 bg-green-50/40'
    : adminOnly
    ? 'border-amber-100 bg-amber-50/30'
    : 'border-gray-200 bg-white'

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${rowCls}`}>
      <div className={`mt-0.5 h-7 w-7 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${iconCls}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${done ? 'text-green-800' : 'text-gray-900'}`}>
          {label}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        {adminOnly && !done && (
          <p className="text-xs text-amber-600 mt-1 font-medium">⏳ Awaiting admin review</p>
        )}
        {workerAction && !done && <div className="mt-2">{workerAction}</div>}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WorkerOnboardingPage() {
  const [data,        setData]        = useState<OnboardingData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [token,       setToken]       = useState('')
  const [acknowledging, setAcknowledging] = useState(false)
  const [ackDone,     setAckDone]     = useState(false)
  const [ackError,    setAckError]    = useState<string | null>(null)

  function loadData(t: string) {
    fetch(`/api/worker/onboarding?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const json = await res.json() as OnboardingData | { error: string }
        if (!res.ok) {
          setError((json as { error: string }).error ?? 'Failed to load onboarding data.')
          return
        }
        setData(json as OnboardingData)
      })
      .catch(() => setError('Network error — please try again.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = sessionStorage.getItem('worker_token')
    if (!t) {
      setError('Session expired. Please use your portal link again.')
      setLoading(false)
      return
    }
    setToken(t)
    loadData(t)
  }, [])

  async function handleAcknowledgePolicy() {
    setAcknowledging(true)
    setAckError(null)
    try {
      const res = await fetch('/api/worker/onboarding/acknowledge-policy', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      })
      const json = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) {
        setAckError(json.error ?? 'Failed to save.')
        return
      }
      setAckDone(true)
      // Reload to reflect updated status
      loadData(token)
    } catch {
      setAckError('Network error — please try again.')
    } finally {
      setAcknowledging(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse px-1 pb-6">
        <div className="h-32 rounded-2xl bg-gray-100" />
        <div className="h-6 w-40 rounded bg-gray-100" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!data) return null

  const { status, documents, profile } = data
  const { sections, progress, stage, missing } = status

  const policyAcknowledged = sections.policy || ackDone

  const firstName = profile.first_name ?? 'there'

  // Sort sections: worker-actionable first, then admin
  const allSections = Object.keys(sections) as (keyof OnboardingSections)[]
  const workerFirst = [
    ...allSections.filter((s) => WORKER_SECTIONS.has(s)),
    ...allSections.filter((s) => ADMIN_SECTIONS.has(s)),
  ]

  const stageLabel: Record<string, string> = {
    not_started:     'Not started',
    in_progress:     'In progress',
    awaiting_review: 'Awaiting admin review',
    complete:        'Complete',
  }

  const stageCls: Record<string, string> = {
    not_started:     'bg-gray-50 text-gray-600 ring-gray-400/30',
    in_progress:     'bg-blue-50 text-blue-700 ring-blue-500/30',
    awaiting_review: 'bg-amber-50 text-amber-700 ring-amber-500/30',
    complete:        'bg-green-50 text-green-700 ring-green-500/30',
  }

  return (
    <div className="space-y-6 pb-8">

      {/* ── Header hero card ─────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <ProgressRing pct={progress} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-white">{progress}%</span>
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Hi {firstName}!</h1>
            <p className="text-indigo-200 text-sm mt-0.5">
              {stage === 'complete'
                ? 'Your onboarding is complete 🎉'
                : stage === 'awaiting_review'
                ? "Great work! Your admin is reviewing your profile."
                : 'Complete the steps below to finish your onboarding.'}
            </p>
            <span className={`mt-2 inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ring-1 ring-inset ${stageCls[stage]}`}>
              {stageLabel[stage]}
            </span>
          </div>
        </div>
      </div>

      {/* ── All clear ────────────────────────────────────────────────────── */}
      {stage === 'complete' && (
        <div className="rounded-2xl bg-green-50 border border-green-200 p-5 text-center">
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-lg font-bold text-green-800">You&apos;re all done!</p>
          <p className="text-sm text-green-700 mt-1">
            Your profile is complete. Your manager will be in touch with your start details.
          </p>
        </div>
      )}

      {/* ── Awaiting review message ───────────────────────────────────────── */}
      {stage === 'awaiting_review' && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">⏳</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Waiting for admin review</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              You&apos;ve completed all worker tasks. Your admin is now reviewing your documents and
              profile. We&apos;ll be in touch once you&apos;re fully activated.
            </p>
          </div>
        </div>
      )}

      {/* ── Missing items alert ──────────────────────────────────────────── */}
      {missing.length > 0 && stage !== 'awaiting_review' && stage !== 'complete' && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-xs font-semibold text-red-700 mb-1.5">Still needed:</p>
          <ul className="space-y-0.5">
            {missing.map((m) => (
              <li key={m} className="text-xs text-red-600 flex items-center gap-1.5">
                <span>•</span> {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Checklist ────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Your checklist</h2>
        <div className="space-y-2">
          {workerFirst.map((section) => {
            const done      = sections[section]
            const isAdminOnly = ADMIN_SECTIONS.has(section)

            let workerAction: React.ReactNode = null

            if (!done && section === 'documents') {
              workerAction = (
                <Link
                  href="/worker/documents"
                  className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 active:scale-95 transition-all"
                >
                  Upload documents →
                </Link>
              )
            }

            if (!done && section === 'policy' && !policyAcknowledged) {
              workerAction = (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    By tapping "I Acknowledge" you confirm you have read and understood the
                    company&apos;s policies and procedures.
                  </p>
                  {ackError && <p className="text-xs text-red-600">{ackError}</p>}
                  <button
                    onClick={handleAcknowledgePolicy}
                    disabled={acknowledging}
                    className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {acknowledging ? 'Saving…' : '✓ I Acknowledge'}
                  </button>
                </div>
              )
            }

            if (!done && WORKER_SECTIONS.has(section) && section !== 'documents' && section !== 'policy') {
              workerAction = (
                <Link
                  href="/worker/profile"
                  className="inline-flex items-center rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 active:scale-95 transition-all"
                >
                  Update profile →
                </Link>
              )
            }

            // For compliance sections show uploaded doc statuses
            if (section === 'documents' && documents.length > 0) {
              workerAction = (
                <div className="mt-2 space-y-1.5">
                  {documents.slice(0, 4).map((doc) => {
                    const reviewedStatus = doc.reviewed_status
                    const reviewLabel = reviewedStatus === 'approved'
                      ? '✓ Approved'
                      : reviewedStatus === 'rejected'
                      ? '✕ Rejected — please reupload'
                      : '⏳ Awaiting review'
                    const reviewCls = reviewedStatus === 'approved'
                      ? 'text-green-600'
                      : reviewedStatus === 'rejected'
                      ? 'text-red-600 font-medium'
                      : 'text-amber-600'
                    return (
                      <div key={doc.id} className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 truncate max-w-[55%]">
                          {doc.document_type.replace(/_/g, ' ')}
                        </span>
                        <span className={`text-xs ${reviewCls}`}>{reviewLabel}</span>
                      </div>
                    )
                  })}
                  {documents.length > 0 && (
                    <Link
                      href="/worker/documents"
                      className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
                    >
                      {done ? 'View all documents →' : 'Upload more →'}
                    </Link>
                  )}
                </div>
              )
            }

            return (
              <StepRow
                key={section}
                label={SECTION_LABELS[section] ?? section}
                description={SECTION_DESCS[section] ?? ''}
                done={done || (section === 'policy' && policyAcknowledged)}
                adminOnly={isAdminOnly}
                workerAction={workerAction}
              />
            )
          })}
        </div>
      </div>

      {/* ── What happens next ────────────────────────────────────────────── */}
      {(stage === 'in_progress' || stage === 'awaiting_review') && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
            What happens next
          </h3>
          <ol className="space-y-2">
            {(() => {
              const isAwaitingOrComplete = stage === 'awaiting_review'
              const steps = [
                { label: 'Complete all checklist steps above', done: isAwaitingOrComplete },
                { label: 'Admin reviews your documents',       done: false },
                { label: "You'll receive a confirmation email once you're active", done: false },
              ]
              return steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                  <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${step.done ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                    {step.done ? '✓' : i + 1}
                  </span>
                  <span className={step.done ? 'line-through text-gray-400' : ''}>{step.label}</span>
                </li>
              ))
            })()}
          </ol>
        </div>
      )}

      {/* ── Quick links ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/worker/documents"
          className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-center hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
        >
          <p className="text-xl mb-1">📎</p>
          <p className="text-xs font-semibold text-gray-700">My Documents</p>
        </Link>
        <Link
          href="/worker/profile"
          className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-center hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
        >
          <p className="text-xl mb-1">👤</p>
          <p className="text-xs font-semibold text-gray-700">My Profile</p>
        </Link>
      </div>

    </div>
  )
}
