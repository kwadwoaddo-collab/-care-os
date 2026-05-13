/**
 * MobilePageHeader
 *
 * A reusable page-title component visible ONLY on mobile (lg:hidden).
 * Renders a prominent h1 + optional subtitle, matching the spec gallery's
 * 24–28px headline typography system.
 *
 * Usage:
 *   <MobilePageHeader title="Staff" subtitle="42 profiles" />
 */

interface MobilePageHeaderProps {
  title:    string
  subtitle?: string
  action?:  React.ReactNode
}

export default function MobilePageHeader({ title, subtitle, action }: MobilePageHeaderProps) {
  return (
    <div className="lg:hidden flex items-start justify-between mb-4 pt-1">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="ml-4 flex-shrink-0">{action}</div>
      )}
    </div>
  )
}
