/**
 * Button — standardised button with consistent variants and states.
 *
 * Replaces 13+ ad-hoc button pattern instances.
 *
 * Usage:
 *   <Button>Save</Button>
 *   <Button variant="secondary">Cancel</Button>
 *   <Button variant="danger">Delete</Button>
 *   <Button loading>Saving…</Button>
 *   <Button variant="ghost" size="sm">View →</Button>
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'warning'
export type ButtonSize    = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant
  size?:     ButtonSize
  loading?:  boolean
  children:  ReactNode
}

const VARIANT_CLS: Record<ButtonVariant, string> = {
  primary:   'bg-indigo-600 text-white hover:bg-indigo-700 border-transparent',
  secondary: 'bg-surface-container-lowest text-slate-700 border-slate-200 hover:bg-slate-50',
  danger:    'bg-red-600 text-white hover:bg-red-700 border-transparent',
  ghost:     'bg-transparent text-indigo-600 hover:text-indigo-800 border-transparent hover:underline',
  warning:   'bg-amber-600 text-white hover:bg-amber-700 border-transparent',
}

const SIZE_CLS: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
}

export default function Button({
  variant  = 'primary',
  size     = 'md',
  loading  = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg border transition-colors',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
        VARIANT_CLS[variant],
        SIZE_CLS[size],
        className,
      ].join(' ')}
    >
      {loading && (
        <span
          className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
}
