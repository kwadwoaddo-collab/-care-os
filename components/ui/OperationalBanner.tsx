'use client'

import Link from 'next/link'
import { useState } from 'react'

export type BannerType = 'critical' | 'warning' | 'info' | 'success' | 'neutral'

interface BannerAction {
  label: string
  href?: string
  onClick?: () => void
}

interface OperationalBannerProps {
  type:        BannerType
  message:     string
  detail?:     string
  icon?:       string
  action?:     BannerAction
  dismissible? :boolean
  onDismiss?:  () => void
  className?:  string
}

const TYPE_CONFIG: Record<BannerType, { bg: string; border: string; text: string; detail: string; actionCls: string; defaultIcon: string }> = {
  critical: { bg: 'bg-red-50',    border: 'border-red-300',   text: 'text-red-800',    detail: 'text-red-700',   actionCls: 'bg-red-600 hover:bg-red-700 text-white',   defaultIcon: '🚨' },
  warning:  { bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-800',  detail: 'text-amber-700', actionCls: 'bg-amber-600 hover:bg-amber-700 text-white', defaultIcon: '⚠️' },
  info:     { bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-800',   detail: 'text-blue-700',  actionCls: 'bg-blue-600 hover:bg-blue-700 text-white',   defaultIcon: 'ℹ️' },
  success:  { bg: 'bg-emerald-50',border: 'border-emerald-200',text: 'text-emerald-800',detail: 'text-emerald-700',actionCls: 'bg-emerald-600 hover:bg-emerald-700 text-white', defaultIcon: '✅' },
  neutral:  { bg: 'bg-slate-50',  border: 'border-slate-200', text: 'text-slate-700',  detail: 'text-slate-600', actionCls: 'bg-slate-600 hover:bg-slate-700 text-white',  defaultIcon: '💬' },
}

export default function OperationalBanner({
  type,
  message,
  detail,
  icon,
  action,
  dismissible = false,
  onDismiss,
  className = '',
}: OperationalBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const cfg = TYPE_CONFIG[type]

  if (dismissed) return null

  function dismiss() {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <div
      role="alert"
      className={`${cfg.bg} ${cfg.border} border rounded-xl p-4 flex items-start gap-3 ${className}`}
    >
      {(icon ?? cfg.defaultIcon) && (
        <span className="text-lg shrink-0 mt-0.5" aria-hidden="true">
          {icon ?? cfg.defaultIcon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${cfg.text}`}>{message}</p>
        {detail && (
          <p className={`text-xs mt-0.5 ${cfg.detail}`}>{detail}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {action && (
          action.href ? (
            <Link
              href={action.href}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${cfg.actionCls}`}
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${cfg.actionCls}`}
            >
              {action.label}
            </button>
          )
        )}
        {dismissible && (
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="text-xs text-slate-400 hover:text-slate-600 ml-1 font-medium"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
