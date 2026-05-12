'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getAssignableRoles, canManageRoles } from '@/lib/rbac/can'
import { getAccessState, getAccessStateMessage } from '@/lib/rbac/access'
import type { Role } from '@/lib/rbac/roles'

// ── Role metadata ─────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; description: string; warning?: string; colour: string }> = {
  care_worker: {
    label:       'Care Worker',
    description: 'Worker portal only — shifts, visit notes, availability, document uploads.',
    colour:      'bg-gray-100 text-gray-700 ring-gray-400/30',
  },
  coordinator: {
    label:       'Coordinator',
    description: 'Rota management, shift allocation, day-to-day operational coordination.',
    colour:      'bg-blue-50 text-blue-700 ring-blue-500/30',
  },
  compliance_manager: {
    label:       'Compliance Manager',
    description: 'Onboarding approvals, document review, training compliance, expiry tracking.',
    colour:      'bg-indigo-50 text-indigo-700 ring-indigo-500/30',
  },
  registered_manager: {
    label:       'Registered Manager',
    description: 'Operational oversight, safeguarding, incidents, CQC/QA oversight, workforce supervision.',
    colour:      'bg-purple-50 text-purple-700 ring-purple-500/30',
  },
  company_admin: {
    label:       'Company Admin',
    description: 'Full company control — user management, settings, operational oversight, reporting.',
    warning:     '⚠️ This grants full company-wide administrative access including role management.',
    colour:      'bg-amber-50 text-amber-700 ring-amber-500/30',
  },
  unknown: {
    label:       'Unknown',
    description: 'Role not recognised.',
    colour:      'bg-gray-100 text-gray-500 ring-gray-400/20',
  },
}

function roleMeta(role: string | null) {
  return ROLE_META[role ?? 'unknown'] ?? ROLE_META.unknown
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RoleManagementPanelProps {
  staffProfileId:    string
  profileId:         string | null   // null → no admin portal account
  currentRole:       string | null   // from profiles.role
  callerRole:        string          // the currently logged-in admin's role
  lastChangedBy:     string | null
  lastChangedAt:     string | null
  /** True if staff_profiles.portal_token_hash is non-null (worker portal active) */
  portalTokenActive: boolean
  /** When the admin invite was last sent (may be null) */
  adminInviteSentAt: string | null
}

// ── Admin Access Button ───────────────────────────────────────────────────────

function AdminAccessButton({ staffProfileId, adminInviteSentAt }: {
  staffProfileId:    string
  adminInviteSentAt: string | null
}) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [done,    setDone]    = useState(false)

  async function handleCreate() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/admin/staff/${staffProfileId}/admin-access`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ send_email: true }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        setError(json.error ?? 'Failed to create admin access.')
        return
      }
      setDone(true)
      setTimeout(() => {
        setOpen(false)
        router.refresh()
      }, 1500)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        id="create-admin-access-btn"
        type="button"
        onClick={() => { setOpen(true); setError(null); setDone(false) }}
        style={{
          display:      'inline-flex',
          alignItems:   'center',
          gap:          '6px',
          fontSize:     '13px',
          fontWeight:   500,
          padding:      '7px 14px',
          borderRadius: '6px',
          border:       '1px solid #2563eb',
          background:   '#2563eb',
          color:        '#fff',
          cursor:       'pointer',
          whiteSpace:   'nowrap',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
          <path fillRule="evenodd" d="M15.5 8a.5.5 0 01.5.5v1h1a.5.5 0 010 1h-1v1a.5.5 0 01-1 0v-1h-1a.5.5 0 010-1h1v-1a.5.5 0 01.5-.5z" clipRule="evenodd" />
        </svg>
        {adminInviteSentAt ? 'Resend Admin Invite' : 'Create Admin Portal Access'}
      </button>

      {open && (
        <div
          style={{
            position:        'fixed',
            inset:           0,
            zIndex:          50,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            background:      'rgba(0,0,0,0.4)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div style={{
            background:   '#fff',
            borderRadius: '12px',
            padding:      '28px',
            width:        'min(440px, 92vw)',
            boxShadow:    '0 20px 60px rgba(0,0,0,0.18)',
          }}>
            {done ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <p style={{ fontSize: '32px', marginBottom: '8px' }}>✅</p>
                <p style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Admin account created</p>
                <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Invite email sent. Refreshing…</p>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>
                  Create Admin Portal Access
                </h2>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', lineHeight: '1.5' }}>
                  This will create an admin portal login for this staff member and
                  send them an email to set up their password.
                </p>
                <div style={{
                  padding:      '10px 14px',
                  borderRadius: '8px',
                  background:   '#fffbeb',
                  border:       '1px solid #fde68a',
                  fontSize:     '13px',
                  color:        '#92400e',
                  marginBottom: '20px',
                  lineHeight:   '1.5',
                }}>
                  <strong>Note:</strong> Creating admin access does not automatically
                  promote the user. You must assign an operational role (e.g. Coordinator)
                  manually once their account is created.
                </div>

                {error && (
                  <div style={{
                    padding:      '10px 14px',
                    borderRadius: '8px',
                    background:   '#fef2f2',
                    border:       '1px solid #fecaca',
                    fontSize:     '13px',
                    color:        '#991b1b',
                    marginBottom: '16px',
                  }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    id="create-admin-access-cancel"
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={loading}
                    style={{
                      padding:      '8px 16px',
                      borderRadius: '6px',
                      border:       '1px solid #d1d5db',
                      background:   '#fff',
                      color:        '#374151',
                      fontSize:     '14px',
                      fontWeight:   500,
                      cursor:       'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    id="create-admin-access-confirm"
                    type="button"
                    onClick={() => void handleCreate()}
                    disabled={loading}
                    style={{
                      padding:      '8px 16px',
                      borderRadius: '6px',
                      border:       'none',
                      background:   loading ? '#93c5fd' : '#2563eb',
                      color:        '#fff',
                      fontSize:     '14px',
                      fontWeight:   500,
                      cursor:       loading ? 'wait' : 'pointer',
                    }}
                  >
                    {loading ? 'Creating…' : 'Create & Send Invite'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ── No-access state panel ─────────────────────────────────────────────────────

function AccessStateBanner({
  staffProfileId,
  portalTokenActive,
  profileId,
  callerRole,
  adminInviteSentAt,
}: {
  staffProfileId:    string
  portalTokenActive: boolean
  profileId:         string | null
  callerRole:        string
  adminInviteSentAt: string | null
}) {
  const state   = getAccessState({ hasWorkerToken: portalTokenActive, hasAdminAccount: !!profileId })
  const msg     = getAccessStateMessage(state)
  const canAdmin = canManageRoles(callerRole) && !profileId

  return (
    <div style={{
      padding:      '14px 16px',
      borderRadius: '8px',
      background:   state === 'no_access' ? '#f9fafb' : '#eff6ff',
      border:       `1px solid ${state === 'no_access' ? '#e5e7eb' : '#bfdbfe'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>
            {state === 'worker_only' ? '🔒 ' : '⚠️ '}{msg.status}
          </p>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>
            {msg.description}
          </p>
          {adminInviteSentAt && (
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>
              Last admin invite sent: {formatDate(adminInviteSentAt)}
            </p>
          )}
        </div>
        {canAdmin && msg.showCreateAdminButton && (
          <div style={{ flexShrink: 0 }}>
            <AdminAccessButton
              staffProfileId={staffProfileId}
              adminInviteSentAt={adminInviteSentAt}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RoleManagementPanel({
  staffProfileId,
  profileId,
  currentRole,
  callerRole,
  lastChangedBy,
  lastChangedAt,
  portalTokenActive,
  adminInviteSentAt,
}: RoleManagementPanelProps) {
  const router = useRouter()

  const [modalOpen,    setModalOpen]    = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [reason,       setReason]       = useState('')
  const [loading,      setLoading]      = useState(false)
  const [banner,       setBanner]       = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const assignable = getAssignableRoles(callerRole)
  const canChange  = canManageRoles(callerRole) && !!profileId

  const openModal = useCallback(() => {
    setSelectedRole(currentRole ?? assignable[0] ?? '')
    setReason('')
    setBanner(null)
    setModalOpen(true)
    dialogRef.current?.showModal()
  }, [currentRole, assignable])

  const closeModal = useCallback(() => {
    dialogRef.current?.close()
    setModalOpen(false)
  }, [])

  // Close on Escape
  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    function onClose() { setModalOpen(false) }
    dlg.addEventListener('close', onClose)
    return () => dlg.removeEventListener('close', onClose)
  }, [])

  async function handleConfirm() {
    if (!selectedRole || loading) return
    setLoading(true)
    setBanner(null)
    try {
      const res  = await fetch(`/api/admin/staff/${staffProfileId}/role`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ role: selectedRole, reason: reason.trim() || undefined }),
      })
      const json = await res.json() as Record<string, unknown>

      if (!res.ok) {
        setBanner({ type: 'error', message: (json.error as string) ?? 'Failed to update role.' })
      } else {
        setBanner({ type: 'success', message: `Role updated to ${roleMeta(selectedRole).label}.` })
        closeModal()
        router.refresh()
      }
    } catch {
      setBanner({ type: 'error', message: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const meta    = roleMeta(currentRole)
  const selMeta = roleMeta(selectedRole)

  return (
    <div>
      {/* ── Access state display ─────────────────────────────────────────── */}
      {!profileId ? (
        <AccessStateBanner
          staffProfileId={staffProfileId}
          portalTokenActive={portalTokenActive}
          profileId={profileId}
          callerRole={callerRole}
          adminInviteSentAt={adminInviteSentAt}
        />
      ) : (
        <>
          {/* ── Admin account active: show role UI ──────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${meta.colour}`}>
                {meta.label}
              </span>
              <p style={{ marginTop: '6px', fontSize: '13px', color: '#6b7280' }}>{meta.description}</p>

              {/* History line */}
              {lastChangedBy && lastChangedAt && (
                <p style={{ marginTop: '8px', fontSize: '12px', color: '#9ca3af' }}>
                  Last changed by <strong style={{ color: '#6b7280' }}>{lastChangedBy}</strong>
                  {' '}· {formatDate(lastChangedAt)}
                </p>
              )}
            </div>

            {canChange && (
              <button
                id="change-role-btn"
                type="button"
                onClick={openModal}
                style={{
                  flexShrink:  0,
                  fontSize:    '13px',
                  fontWeight:  500,
                  padding:     '6px 12px',
                  borderRadius:'6px',
                  border:      '1px solid #d1d5db',
                  background:  '#fff',
                  color:       '#374151',
                  cursor:      'pointer',
                  whiteSpace:  'nowrap',
                }}
              >
                Change role
              </button>
            )}
          </div>

          {/* Inline banner (outside modal) */}
          {banner && !modalOpen && (
            <div style={{
              marginTop:   '12px',
              padding:     '10px 14px',
              borderRadius:'8px',
              fontSize:    '13px',
              background:  banner.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color:       banner.type === 'success' ? '#166534' : '#991b1b',
              border:      `1px solid ${banner.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            }}>
              {banner.message}
            </div>
          )}
        </>
      )}

      {/* ── Confirmation modal ───────────────────────────────────────────── */}
      <dialog
        ref={dialogRef}
        id="role-change-modal"
        style={{
          border:       'none',
          borderRadius: '12px',
          boxShadow:    '0 20px 60px rgba(0,0,0,0.18)',
          padding:      '0',
          width:        'min(480px, 92vw)',
          maxHeight:    '90vh',
          overflowY:    'auto',
        }}
      >
        <div style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>
            Change system role
          </h2>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 20px' }}>
            Changing this role will immediately affect what this person can access.
          </p>

          {/* Modal banner */}
          {banner && modalOpen && (
            <div style={{
              marginBottom: '16px',
              padding:      '10px 14px',
              borderRadius: '8px',
              fontSize:     '13px',
              background:   banner.type === 'error' ? '#fef2f2' : '#f0fdf4',
              color:        banner.type === 'error' ? '#991b1b' : '#166534',
              border:       `1px solid ${banner.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
            }}>
              {banner.message}
            </div>
          )}

          {/* Role selector */}
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="role-select" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
              New role
            </label>
            <select
              id="role-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              disabled={loading}
              style={{
                width:        '100%',
                padding:      '8px 10px',
                borderRadius: '6px',
                border:       '1px solid #d1d5db',
                fontSize:     '14px',
                color:        '#111827',
                background:   '#fff',
                cursor:       'pointer',
              }}
            >
              <option value="" disabled>Select role…</option>
              {assignable.map((r) => (
                <option key={r} value={r}>{roleMeta(r).label}</option>
              ))}
            </select>

            {/* Role description + warning */}
            {selectedRole && (
              <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{selMeta.description}</p>
                {selMeta.warning && (
                  <p style={{ fontSize: '12px', color: '#92400e', marginTop: '6px', fontWeight: 500 }}>{selMeta.warning}</p>
                )}
              </div>
            )}
          </div>

          {/* Reason field */}
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="role-reason" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
              Reason <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span>
            </label>
            <input
              id="role-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Promoted to coordinator"
              disabled={loading}
              maxLength={200}
              style={{
                width:        '100%',
                padding:      '8px 10px',
                borderRadius: '6px',
                border:       '1px solid #d1d5db',
                fontSize:     '14px',
                color:        '#111827',
                boxSizing:    'border-box',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              id="role-change-cancel"
              type="button"
              onClick={closeModal}
              disabled={loading}
              style={{
                padding:      '8px 16px',
                borderRadius: '6px',
                border:       '1px solid #d1d5db',
                background:   '#fff',
                color:        '#374151',
                fontSize:     '14px',
                fontWeight:   500,
                cursor:       'pointer',
              }}
            >
              Cancel
            </button>
            <button
              id="role-change-confirm"
              type="button"
              onClick={() => void handleConfirm()}
              disabled={loading || !selectedRole || selectedRole === currentRole}
              style={{
                padding:      '8px 16px',
                borderRadius: '6px',
                border:       'none',
                background:   loading ? '#93c5fd' : '#2563eb',
                color:        '#fff',
                fontSize:     '14px',
                fontWeight:   500,
                cursor:       loading ? 'wait' : 'pointer',
                opacity:      (!selectedRole || selectedRole === currentRole) ? 0.5 : 1,
              }}
            >
              {loading ? 'Saving…' : 'Confirm change'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
