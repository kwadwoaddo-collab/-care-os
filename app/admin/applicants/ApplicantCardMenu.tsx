'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

interface Props {
  applicantId: string
  applicantName: string
  status: string
}

type ActionItem = {
  label: string
  icon: string
  href?: string
  action?: () => Promise<void>
  danger?: boolean
  disabled?: boolean
}

export default function ApplicantCardMenu({ applicantId, applicantName, status }: Props) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const ref                   = useRef<HTMLDivElement>(null)
  const router                = useRouter()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function patchStatus(targetStatus: string) {
    setLoading(targetStatus)
    await fetch(`/api/admin/applicants/${applicantId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: targetStatus }),
    })
    setLoading(null)
    setOpen(false)
    router.refresh()
  }

  async function convertToStaff() {
    setLoading('convert')
    const res = await fetch(`/api/admin/applicants/${applicantId}/convert`, { method: 'POST' })
    setLoading(null)
    setOpen(false)
    if (res.ok) {
      const body = await res.json() as { staff_profile?: { id: string } }
      if (body.staff_profile?.id) {
        router.push(`/admin/staff/${body.staff_profile.id}`)
      } else {
        router.refresh()
      }
    }
  }

  const isActive     = ['applied', 'shortlisted', 'interview_scheduled'].includes(status)
  const isHired      = status === 'hired'
  const isRejected   = status === 'rejected'
  const isWithdrawn  = status === 'withdrawn'

  const actions: ActionItem[] = []

  // Always: View Application / Recruitment File
  actions.push({ label: 'View Recruitment File', icon: 'folder_shared', href: `/admin/applicants/${applicantId}` })

  if (isActive) {
    if (status !== 'shortlisted') {
      actions.push({ label: 'Move to Shortlist', icon: 'playlist_add_check', action: () => patchStatus('shortlisted') })
    }
    if (status !== 'interview_scheduled') {
      actions.push({ label: 'Schedule Interview', icon: 'event', action: () => patchStatus('interview_scheduled') })
    }
    actions.push({ label: 'Move to Hired', icon: 'check_circle', action: () => patchStatus('hired') })
    actions.push({ label: 'Reject / Archive', icon: 'archive', danger: true, action: () => patchStatus('rejected') })
  }

  if (isHired) {
    actions.push({ label: 'Convert to Staff', icon: 'badge', action: convertToStaff })
    actions.push({ label: 'Archive Applicant', icon: 'archive', danger: true, action: () => patchStatus('rejected') })
  }

  if (isRejected) {
    actions.push({ label: 'Restore Applicant', icon: 'restore', action: () => patchStatus('applied') })
    // Permanent deletion requires the "type DELETE" confirmation — direct to the archived page.
    actions.push({ label: 'Permanently Delete…', icon: 'delete_forever', danger: true, href: '/admin/applicants/archived' })
  }

  if (isWithdrawn) {
    actions.push({ label: 'Restore Applicant', icon: 'restore', action: () => patchStatus('applied') })
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v) }}
        className="material-symbols-outlined text-outline hover:text-primary transition-colors p-0.5 rounded"
        aria-label={`Actions for ${applicantName}`}
        aria-expanded={open}
        aria-haspopup="menu"
        style={{ fontSize: '22px' }}
      >
        more_vert
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 bottom-8 z-50 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1 overflow-hidden"
        >
          {actions.map((item) => {
            const isLoading = loading !== null
            const key = item.label

            if (item.href) {
              return (
                <a
                  key={key}
                  href={item.href}
                  role="menuitem"
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    item.danger
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon name={item.icon} size="sm" />
                  {item.label}
                </a>
              )
            }

            return (
              <button
                key={key}
                role="menuitem"
                disabled={isLoading}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); item.action?.() }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors disabled:opacity-50 ${
                  item.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {loading === (item.label === 'Convert to Staff' ? 'convert' : item.label === 'Delete Permanently' ? 'delete' : item.label) ? (
                  <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <Icon name={item.icon} size="sm" className="shrink-0" />
                )}
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
