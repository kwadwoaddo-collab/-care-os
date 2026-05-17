import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/rbac/permissions'
import { canManageStaff, canViewCompliance } from '@/lib/rbac/can'
import AccessDenied from '@/components/admin/AccessDenied'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SectionCard {
  href: string
  icon: string
  title: string
  description: string
  badge?: string
}

interface Section {
  label: string
  icon: string
  cards: SectionCard[]
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WorkforceCard({ href, icon, title, description, badge }: SectionCard) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 bg-white rounded-xl border border-outline-variant px-5 py-4 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] hover:border-[#4f46e5]/30 hover:shadow-[0_4px_16px_-4px_rgba(79,70,229,0.12)] transition-all duration-200"
    >
      <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-[#4f46e5]/10 flex items-center justify-center shrink-0 transition-colors duration-200">
        <span
          className="material-symbols-outlined text-slate-600 group-hover:text-[#4f46e5] transition-colors duration-200"
          style={{ fontSize: '20px', fontVariationSettings: "'FILL' 0" }}
        >
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900 group-hover:text-[#4f46e5] transition-colors duration-200 truncate">
            {title}
          </p>
          {badge && (
            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wide">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <span
        className="material-symbols-outlined text-slate-300 group-hover:text-[#4f46e5]/50 shrink-0 mt-0.5 transition-colors duration-200"
        style={{ fontSize: '18px' }}
      >
        chevron_right
      </span>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function WorkforcePage() {
  const auth = await requireAdmin()
  if (!auth.ok) return <AccessDenied />

  const { role } = auth.ctx
  const canSeeApplicants = can(role, 'applicants:read')
  const canSeeStaff      = canManageStaff(role)
  const canSeeCompliance = canViewCompliance(role)

  if (!canSeeApplicants && !canSeeStaff && !canSeeCompliance) {
    return <AccessDenied />
  }

  const sections: Section[] = []

  if (canSeeApplicants) {
    sections.push({
      label: 'Recruitment',
      icon: 'person_search',
      cards: [
        {
          href: '/admin/applicants',
          icon: 'person_add',
          title: 'Talent Pipeline',
          description: 'Review and progress applicants through the hiring stages.',
        },
        {
          href: '/admin/applicants/archived',
          icon: 'archive',
          title: 'Archived Applicants',
          description: 'Rejected applicants — restore or permanently remove.',
          badge: 'archived',
        },
      ],
    })
  }

  if (canSeeStaff) {
    sections.push({
      label: 'Staff',
      icon: 'badge',
      cards: [
        {
          href: '/admin/staff',
          icon: 'groups',
          title: 'Active Staff',
          description: 'View and manage staff profiles, compliance, and availability.',
        },
        {
          href: '/admin/staff/archived',
          icon: 'person_off',
          title: 'Archived Staff',
          description: 'Terminated and inactive staff records.',
          badge: 'archived',
        },
      ],
    })
  }

  if (canSeeCompliance) {
    sections.push({
      label: 'Compliance',
      icon: 'verified_user',
      cards: [
        {
          href: '/admin/compliance',
          icon: 'verified_user',
          title: 'Compliance Dashboard',
          description: 'Track documents, training, and expiry across the workforce.',
        },
      ],
    })
  }

  if (canSeeStaff) {
    sections.push({
      label: 'Onboarding',
      icon: 'how_to_reg',
      cards: [
        {
          href: '/admin/onboarding',
          icon: 'how_to_reg',
          title: 'Onboarding',
          description: 'Monitor staff completing their onboarding requirements.',
        },
      ],
    })
  }

  if (canSeeStaff) {
    sections.push({
      label: 'Capacity Intelligence',
      icon: 'monitoring',
      cards: [
        {
          href: '/admin/workforce/capacity',
          icon: 'monitoring',
          title: 'Workforce Capacity',
          description: 'Deployability scores, shift coverage gaps, and operational pressure across the workforce.',
          badge: 'new',
        },
      ],
    })
  }

  return (
    <div className="space-y-8">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-primary tracking-tight">Workforce</h1>
        <p className="text-sm text-on-surface-variant mt-0.5">
          Recruitment, staff management, compliance, and onboarding — in one place.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {sections.map((section) => (
          <div key={section.label}>
            {/* Section header */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="material-symbols-outlined text-slate-400"
                style={{ fontSize: '18px', fontVariationSettings: "'FILL' 0" }}
              >
                {section.icon}
              </span>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {section.label}
              </h2>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {section.cards.map((card) => (
                <WorkforceCard key={card.href} {...card} />
              ))}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
