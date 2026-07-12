/**
 * Card — standardised container for all admin panel content blocks.
 *
 * Replaces the repeated `bg-surface-container-lowest border border-slate-200 rounded-xl` pattern
 * found across 54+ locations in the codebase.
 *
 * Usage:
 *   <Card>...</Card>
 *   <Card padding="none">...</Card>   // for tables that own their own padding
 *   <Card className="p-6">...</Card>  // explicit padding override
 */

import type { ReactNode } from 'react'

interface CardProps {
  children:   ReactNode
  className?: string
  padding?:   'default' | 'none' | 'sm'
  as?:        'div' | 'section' | 'article'
}

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  default: 'p-5',
  sm:      'p-4',
  none:    '',
}

export default function Card({ children, className = '', padding = 'default', as: Tag = 'div' }: CardProps) {
  return (
    <Tag className={`bg-surface-container-lowest/80 dark:bg-surface-container-lowest/40 backdrop-blur-md border border-black/[0.04] dark:border-white/[0.06] shadow-apple-sm rounded-2xl transition-all duration-300 hover:shadow-apple-md hover:border-black/[0.08] dark:hover:border-white/[0.1] ${PADDING[padding]} ${className}`}>
      {children}
    </Tag>
  )
}
