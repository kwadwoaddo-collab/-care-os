'use client'

/**
 * Worker Onboarding Page
 *
 * Mobile-first guided checklist. Shows:
 *   - Overall progress ring
 *   - Per-section status (worker-actionable vs admin-only)
 *   - Per-training-category status (approved / pending / missing)
 *   - Per-document type status
 *   - Policy acknowledgement action
 *   - Onboarding completion state
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TRAINING_CATEGORY_LABELS } from '@/lib/documents/constants'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkerDoc {
  id:                string
  document_type:     string
  training_category: string | null
  file_name:         string
  expiry_date:       string | null
  created_at:        string
  reviewed_status:   string | null
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
  training:    boolean
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

interface TrainingBreakdown {
  satisfied: string[]
  missing:   string[]
  expired:   string[]
  pending:   string[]
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
  profile:           Profile
  status:            OnboardingStatus
  nextActions:       { id: string; label: string; section: string; urgent: boolean }[]
  documents:         WorkerDoc[]
  trainingBreakdown: TrainingBreakdown
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  personal:   'Personal Details',
  address:    'Home Address',
  emergency:  'Emergency Contact',
  documents:  'Documents',
  policy:     'Company Policies',
  training:   'Mandatory Training',
  hmrc:       'Payroll & HMRC',
  banking:    'Bank Details',
  employment: 'Employment Details',
  compliance: 'Compliance Checks',
}

const SECTION_DESCS: Record<string, string> = {
  personal:   'Full name, date of birth, nationality',
  address:    'Current home address and postcode',
  emergency:  'Name and phone number of emergency contact',
  documents:  'Passport, DBS certificate, right to work, proof of address',
  policy:     'Acknowledge company policies and procedures',
  training:   'Mandatory training certificates (all must be approved)',
  hmrc:       'NI number and starter declaration',
  banking:    'Bank account details for payroll',
  employment: 'Contract type and hours',
  compliance: 'Right to work check and DBS (completed by admin)',
}

const WORKER_SECTIONS = new Set(['personal', 'address', 'emergency', 'documents', 'policy', 'training'])
const ADMIN_SECTIONS  = new Set(['hmrc', 'banking', 'employment', 'compliance'])

// ── Progress Stepper ─────────────────────────────────────────────────────────

type StepStatus = 'complete' | 'current' | 'upcoming'

const STEPPER_STAGES = [
  { id: 'personal', label: 'Personal\nDetails' },
  { id: 'documents', label: 'Documents' },
  { id: 'policies', label: 'Policies' },
  { id: 'complete', label: 'Complete' },
] as const

function ProgressStepper({ stage }: { stage: string }) {
  // Map onboarding stage to stepper index
  const stageToIndex: Record<string, number> = {
    not_started:     0,
    in_progress:     1,
    awaiting_review: 2,
    complete:        3,
  }
  const currentIdx = stageToIndex[stage] ?? 1

  return (
    <div className="flex items-center w-full px-1" role="list" aria-label="Onboarding steps">
      {STEPPER_STAGES.map((step, i) => {
        const status: StepStatus =
          i < currentIdx  ? 'complete'
          : i === currentIdx ? 'current'
          : 'upcoming'
        const isLast = i === STEPPER_STAGES.length - 1

        const circleCls = {
          complete: 'bg-green-500  border-green-500  text-white',
          current:  'bg-indigo-600 border-indigo-600 text-white',
          upcoming: 'bg-white      border-gray-300    text-gray-400',
        }[status]

        const labelCls = {
          complete: 'text-green-700 font-semibold',
          current:  'text-indigo-700 font-bold',
          upcoming: 'text-gray-400',
        }[status]

        const lineCls = i < currentIdx
          ? 'bg-green-400'
          : 'bg-gray-200'

        return (
          <div key={step.id} className="flex items-center flex-1 min-w-0" role="listitem">
            {/* Step circle + label */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ${circleCls}`}
                aria-label={`Step ${i + 1}: ${step.label.replace('\n', ' ')} — ${status}`}
              >
                {status === 'complete' ? '✓' : i + 1}
              </div>
              <span
                className={`mt-1 text-center leading-tight whitespace-pre-line text-[10px] ${labelCls}`}
                style={{ maxWidth: '52px' }}
              >
                {step.label}
              </span>
            </div>
            {/* Connector line (not after last step) */}
            {!isLast && (
              <div className={`h-0.5 flex-1 mx-1 mb-4 rounded-full transition-all ${lineCls}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Progress ring ─────────────────────────────────────────────────────────────

function ProgressRing({ pct }: { pct: number }) {
  const r      = 40
  const c      = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  const color  = pct === 100 ? '#16a34a' : pct >= 60 ? '#4f46e5' : '#f59e0b'
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="transform -rotate-90">
      <circle cx="48" cy="48" r={r} fill="none" stroke="#ffffff33" strokeWidth="8" />
      <circle
        cx="48" cy="48" r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  )
}

// ── Training category status pill ─────────────────────────────────────────────

function TrainingPill({
  category, status,
}: {
  category: string
  status: 'approved' | 'pending' | 'expired' | 'missing'
}) {
  const label = TRAINING_CATEGORY_LABELS[category as keyof typeof TRAINING_CATEGORY_LABELS] ?? category.replace(/_/g, ' ')

  const { icon, cls, hint } = {
    approved: { icon: '✓', cls: 'bg-green-50 border-green-200 text-green-800', hint: 'Approved' },
    pending:  { icon: '⏳', cls: 'bg-amber-50 border-amber-200 text-amber-800', hint: 'Pending review' },
    expired:  { icon: '⚠️', cls: 'bg-red-50 border-red-200 text-red-800',      hint: 'Expired' },
    missing:  { icon: '○',  cls: 'bg-gray-50 border-gray-200 text-gray-600',   hint: 'Not uploaded' },
  }[status]

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${cls}`}>
      <span className="text-sm">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{label}</p>
        <p className="text-xs opacity-70">{hint}</p>
      </div>
      {status === 'missing' && (
        <Link
          href="/worker/documents"
          className="text-xs font-semibold text-indigo-600 hover:underline flex-shrink-0"
        >
          Upload →
        </Link>
      )}
      {status === 'expired' && (
        <Link
          href="/worker/documents"
          className="text-xs font-semibold text-red-600 hover:underline flex-shrink-0"
        >
          Renew →
        </Link>
      )}
    </div>
  )
}

// ── Step row ──────────────────────────────────────────────────────────────────

function StepRow({
  label, description, done, adminOnly, workerAction,
}: {
  label:        string
  description:  string
  done:         boolean
  adminOnly:    boolean
  workerAction?: React.ReactNode
}) {
  const icon    = done ? '✓' : adminOnly ? '⏳' : '○'
  const iconCls = done ? 'bg-green-100 text-green-700' : adminOnly ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'
  const rowCls  = done ? 'border-green-100 bg-green-50/40' : adminOnly ? 'border-amber-100 bg-amber-50/30' : 'border-gray-200 bg-surface-container-lowest'

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${rowCls}`}>
      <div className={`mt-0.5 h-7 w-7 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${iconCls}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${done ? 'text-green-800' : 'text-gray-900'}`}>{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        {adminOnly && !done && <p className="text-xs text-amber-600 mt-1 font-medium">⏳ Awaiting admin review</p>}
        {workerAction && !done && <div className="mt-2">{workerAction}</div>}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WorkerOnboardingPage() {
  const [data,          setData]         = useState<OnboardingData | null>(null)
  const [loading,       setLoading]      = useState(true)
  const [error,         setError]        = useState<string | null>(null)
  const [token,         setToken]        = useState('')
  const [acknowledging, setAcknowledging] = useState(false)
  const [ackDone,       setAckDone]      = useState(false)
  const [ackError,      setAckError]     = useState<string | null>(null)

  function loadData(t: string) {
    fetch(`/api/worker/onboarding?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const json = await res.json() as OnboardingData | { error: string }
        if (!res.ok) { setError((json as { error: string }).error ?? 'Failed to load.'); return }
        setData(json as OnboardingData)
      })
      .catch(() => setError('Network error — please try again.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = sessionStorage.getItem('worker_token')
    if (!t) { setError('Session expired. Please use your portal link again.'); setLoading(false); return }
    setToken(t)
    loadData(t)
  }, [])

  async function handleAcknowledgePolicy() {
    setAcknowledging(true)
    setAckError(null)
    try {
      const res  = await fetch('/api/worker/onboarding/acknowledge-policy', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      })
      const json = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) { setAckError(json.error ?? 'Failed to save.'); return }
      setAckDone(true)
      loadData(token)
    } catch { setAckError('Network error — please try again.') }
    finally   { setAcknowledging(false) }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse px-1 pb-6">
        <div className="h-32 rounded-2xl bg-gray-100" />
        <div className="h-6 w-40 rounded bg-gray-100" />
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100" />)}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
    )
  }

  if (!data) return null

  const { status, documents, profile, trainingBreakdown } = data
  const { sections, progress, stage, missing } = status

  const policyAcknowledged = sections.policy || ackDone
  const firstName          = profile.first_name ?? 'there'

  // Build training section UI
  const allTraining = [
    ...trainingBreakdown.satisfied.map((c) => ({ cat: c, status: 'approved' as const })),
    ...trainingBreakdown.pending.map((c)   => ({ cat: c, status: 'pending' as const })),
    ...trainingBreakdown.expired.map((c)   => ({ cat: c, status: 'expired' as const })),
    ...trainingBreakdown.missing.map((c)   => ({ cat: c, status: 'missing' as const })),
  ]
  // Dedupe (a category should only appear in one bucket)
  const trainingByCat = new Map(allTraining.map((t) => [t.cat, t]))
  const trainingList  = [...trainingByCat.values()]

  const trainingDone = sections.training

  // Sort sections: worker-actionable first, admin last
  const sectionOrder = ['personal', 'address', 'emergency', 'documents', 'policy', 'training', 'hmrc', 'banking', 'employment', 'compliance']
  const allSectionKeys = sectionOrder.filter((s) => s in sections) as (keyof OnboardingSections)[]

  const stageLabel: Record<string, string> = {
    not_started:     'Not started',
    in_progress:     'In progress',
    awaiting_review: 'Awaiting admin review',
    complete:        'Complete',
  }
  const stageCls: Record<string, string> = {
    not_started:     'bg-white/20 text-white',
    in_progress:     'bg-white/20 text-white',
    awaiting_review: 'bg-amber-100 text-amber-800',
    complete:        'bg-green-100 text-green-800',
  }

  return (
    <div className="space-y-5 pb-8">

      {/* ── Progress stepper ────────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-2xl border border-gray-200 px-4 py-4">
        <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-widest">Your progress</p>
        <ProgressStepper stage={stage} />
      </div>

      {/* ── Hero progress card ──────────────────────────────────────────────── */}
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
                ? "You've completed all worker tasks — admin is reviewing."
                : 'Complete the steps below to finish your onboarding.'}
            </p>
            <span className={`mt-2 inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${stageCls[stage]}`}>
              {stageLabel[stage]}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-white/80 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ── Completion celebration ──────────────────────────────────────────── */}
      {stage === 'complete' && (
        <div className="rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-center text-white shadow-lg">
          <div className="text-5xl mb-3" aria-hidden="true">🎉</div>
          <p className="text-xl font-bold mb-1">You&apos;re all set!</p>
          <p className="text-green-100 text-sm leading-relaxed">
            Brilliant work — your onboarding is complete.<br />
            Your manager will be in touch with your start details.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold">
              ✓ Fully verified
            </span>
          </div>
        </div>
      )}

      {/* ── Awaiting review ─────────────────────────────────────────────────── */}
      {stage === 'awaiting_review' && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">⏳</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Waiting for admin review</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              You&apos;ve completed all worker tasks. Your admin is reviewing your documents and profile.
              We&apos;ll be in touch once you&apos;re fully activated.
            </p>
          </div>
        </div>
      )}

      {/* ── Still needed banner ─────────────────────────────────────────────── */}
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

      {/* ── Checklist ───────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Your checklist</h2>
        <div className="space-y-2">
          {allSectionKeys.map((section) => {
            const done        = section === 'policy' ? policyAcknowledged : sections[section]
            const isAdminOnly = ADMIN_SECTIONS.has(section)
            let workerAction: React.ReactNode = null

            // ── Documents section ──────────────────────────────────────────
            if (section === 'documents') {
              const docsByType = new Map<string, WorkerDoc>()
              for (const d of documents) {
                if (!docsByType.has(d.document_type)) docsByType.set(d.document_type, d)
              }
              workerAction = (
                <div className="space-y-1.5">
                  {documents.slice(0, 5).map((doc) => {
                    const rs    = doc.reviewed_status
                    const label = rs === 'approved'   ? '✓ Approved'
                                : rs === 'rejected'   ? '✕ Rejected — reupload'
                                : rs === 'superseded' ? '🔄 Superseded'
                                :                       '⏳ Awaiting review'
                    const cls   = rs === 'approved'   ? 'text-green-600'
                                : rs === 'rejected'   ? 'text-red-600 font-medium'
                                : rs === 'superseded' ? 'text-gray-400'
                                :                       'text-amber-600'
                    return (
                      <div key={doc.id} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-600 truncate max-w-[55%]">
                          {doc.document_type.replace(/_/g, ' ')}
                        </span>
                        <span className={`text-xs ${cls}`}>{label}</span>
                      </div>
                    )
                  })}
                  <Link
                    href="/worker/documents"
                    className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
                  >
                    {done ? 'View all documents →' : 'Upload documents →'}
                  </Link>
                </div>
              )
            }

            // ── Training section ───────────────────────────────────────────
            if (section === 'training') {
              workerAction = (
                <div className="space-y-2 mt-1">
                  {trainingList.length === 0 ? (
                    <p className="text-xs text-gray-500">Loading training requirements…</p>
                  ) : (
                    trainingList.map(({ cat, status: tStatus }) => (
                      <TrainingPill key={cat} category={cat} status={tStatus} />
                    ))
                  )}
                  {trainingBreakdown.missing.length > 0 && (
                    <Link
                      href="/worker/documents"
                      className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 active:scale-95 transition-all"
                    >
                      Upload training certificates →
                    </Link>
                  )}
                </div>
              )
            }

            // ── Policy section ─────────────────────────────────────────────
            if (section === 'policy' && !policyAcknowledged) {
              workerAction = (
                <div className="space-y-2">
                  <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3">
                    <p className="text-xs text-gray-700 leading-relaxed">
                      <strong>Company Policies & Procedures</strong><br />
                      By tapping &ldquo;I Acknowledge&rdquo; you confirm you have read and understood the
                      company&apos;s policies, safeguarding procedures, and code of conduct.
                    </p>
                  </div>
                  {ackError && <p className="text-xs text-red-600">{ackError}</p>}
                  <button
                    id="acknowledge-policy-btn"
                    onClick={handleAcknowledgePolicy}
                    disabled={acknowledging}
                    className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {acknowledging ? 'Saving…' : '✓ I Acknowledge'}
                  </button>
                </div>
              )
            }

            // ── Other worker sections ──────────────────────────────────────
            if (!done && WORKER_SECTIONS.has(section) && !['documents', 'policy', 'training'].includes(section)) {
              workerAction = (
                <Link
                  href="/worker/profile"
                  className="inline-flex items-center rounded-lg border border-indigo-200 bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 active:scale-95 transition-all"
                >
                  Update profile →
                </Link>
              )
            }

            return (
              <StepRow
                key={section}
                label={SECTION_LABELS[section] ?? section}
                description={SECTION_DESCS[section] ?? ''}
                done={done}
                adminOnly={isAdminOnly}
                workerAction={workerAction}
              />
            )
          })}
        </div>
      </div>

      {/* ── What happens next ───────────────────────────────────────────────── */}
      {(stage === 'in_progress' || stage === 'awaiting_review') && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">What happens next</h3>
          <ol className="space-y-2">
            {[
              { label: 'Complete all checklist steps above',                      done: stage === 'awaiting_review' },
              { label: 'Admin reviews your documents',                             done: false },
              { label: "You'll receive a confirmation email once you're active",   done: false },
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${step.done ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                  {step.done ? '✓' : i + 1}
                </span>
                <span className={step.done ? 'line-through text-gray-400' : ''}>{step.label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── Quick links ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/worker/documents"
          className="rounded-xl border border-gray-200 bg-surface-container-lowest px-4 py-3.5 text-center hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
        >
          <p className="text-xl mb-1">📎</p>
          <p className="text-xs font-semibold text-gray-700">My Documents</p>
        </Link>
        <Link
          href="/worker/dashboard"
          className="rounded-xl border border-gray-200 bg-surface-container-lowest px-4 py-3.5 text-center hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
        >
          <p className="text-xl mb-1">🏠</p>
          <p className="text-xs font-semibold text-gray-700">Dashboard</p>
        </Link>
      </div>

    </div>
  )
}
