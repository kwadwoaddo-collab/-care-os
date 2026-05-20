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
    <Tag className={`bg-surface-container-lowest border border-slate-200 rounded-xl ${PADDING[padding]} ${className}`}>
      {children}
    </Tag>
  )
}
