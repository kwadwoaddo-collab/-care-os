'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getAssignableRoles, canManageRoles } from '@/lib/rbac/can'
import { getAccessState } from '@/lib/rbac/access'
import type { Role } from '@/lib/rbac/roles'
import AdminAccessButton from './AdminAccessButton'

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
    colour:      'bg-gray-100 text-on-surface-variant ring-gray-400/20',
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
  /** When the worker last successfully logged into the portal */
  portalLastLoginAt: string | null
  /** When the admin portal invite was sent */
  adminInviteSentAt: string | null
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
  portalLastLoginAt,
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

  const accessState = getAccessState({ hasWorkerToken: portalTokenActive, hasAdminAccount: !!profileId })

  return (
    <div className="space-y-6">
      {/* ── Status overview ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <dt className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-1">Worker Portal</dt>
          <dd className="flex items-center gap-2">
            {portalTokenActive ? (
              <>
                <span className="flex h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-semibold text-primary">Active</span>
              </>
            ) : (
              <>
                <span className="flex h-2 w-2 rounded-full bg-gray-300" />
                <span className="text-sm font-medium text-on-surface-variant">Not configured</span>
              </>
            )}
          </dd>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <dt className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-1">Admin Portal</dt>
          <dd className="flex items-center gap-2">
            {profileId ? (
              <>
                <span className="flex h-2 w-2 rounded-full bg-indigo-500" />
                <span className="text-sm font-semibold text-primary">Account Created</span>
              </>
            ) : (
              <>
                <span className="flex h-2 w-2 rounded-full bg-gray-300" />
                <span className="text-sm font-medium text-on-surface-variant">No admin access</span>
              </>
            )}
          </dd>
        </div>
      </div>

      {/* ── Role detail ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-white border border-gray-200 shadow-sm">
        <div className="flex-1">
          <h4 className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-3">System Permissions</h4>
          {profileId ? (
            <div>
              <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${meta.colour}`}>
                {meta.label}
              </span>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{meta.description}</p>
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant italic">
              {accessState === 'worker_only' 
                ? 'Standard worker portal access. Promote to an operational role by creating admin portal access above.'
                : 'No portal access configured. Use the header actions to invite this staff member.'}
            </p>
          )}

          {/* Audit trace */}
          {(lastChangedBy || adminInviteSentAt) && (
            <div className="mt-6 pt-4 border-t border-gray-100 space-y-2">
              {lastChangedBy && lastChangedAt && (
                <p className="text-xs text-gray-400">
                  Role last updated by <span className="font-medium text-gray-600">{lastChangedBy}</span> on {formatDate(lastChangedAt)}
                </p>
              )}
              {adminInviteSentAt && (
                <p className="text-xs text-gray-400">
                  Portal invite last sent on {formatDate(adminInviteSentAt)}
                </p>
              )}
              {portalLastLoginAt && (
                <p className="text-xs text-gray-400">
                  Worker last logged in on {formatDate(portalLastLoginAt)}
                </p>
              )}
            </div>
          )}
        </div>

        {canChange && (
          <button
            id="change-role-btn"
            type="button"
            onClick={openModal}
            className="flex-shrink-0 inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-primary shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
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
