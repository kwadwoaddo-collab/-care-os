'use client'

import { ReactNode } from 'react'
import Button from './Button'

interface AlertDialogProps {
  isOpen: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  onConfirm: () => void
}

export function AlertDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'OK',
  onConfirm,
}: AlertDialogProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onConfirm()
      }}
    >
      <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-primary mb-2">{title}</h2>
          <div className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
            {message}
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <Button variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
