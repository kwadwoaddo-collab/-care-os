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
  primary:   'bg-primary text-on-primary hover:bg-primary/90 hover:brightness-105 border-transparent shadow-apple-sm active:scale-[0.97]',
  secondary: 'bg-surface-container-highest text-foreground border-transparent hover:bg-surface-container-highest/80 active:scale-[0.97]',
  danger:    'bg-error text-on-error hover:bg-error/90 hover:brightness-105 border-transparent shadow-apple-sm active:scale-[0.97]',
  ghost:     'bg-transparent text-primary hover:bg-primary/10 border-transparent active:scale-[0.98]',
  warning:   'bg-warning text-black hover:bg-warning/90 hover:brightness-105 border-transparent shadow-apple-sm active:scale-[0.97]',
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
        'inline-flex items-center justify-center gap-2 font-medium rounded-xl border transition-all duration-200 select-none',
        'disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
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
