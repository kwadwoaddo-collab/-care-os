'use client'

import { useState } from 'react'

type SendState = 'idle' | 'sending' | 'done' | 'error'

interface SendResult {
  sent?:      number
  recipients?: string[]
  message?:   string
  skipped?:   boolean
  error?:     string
  counts?: {
    expired:      number
    expiringSoon: number
    missing:      number
    total:        number
  }
}

export default function ComplianceActions() {
  const [sendState, setSendState] = useState<SendState>('idle')
  const [result, setResult]       = useState<SendResult | null>(null)

  async function handleSend() {
    if (!window.confirm(
      'Send compliance reminders now?\n\nThis will email all admin users with expired, expiring soon, and missing compliance items.',
    )) return

    setSendState('sending')
    setResult(null)

    try {
      const res = await fetch('/api/admin/compliance/reminders/send', { method: 'POST' })
      const json = await res.json() as SendResult
      setResult(json)
      setSendState(res.ok ? 'done' : 'error')
    } catch {
      setResult({ error: 'Could not reach the server.' })
      setSendState('error')
    }
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {/* Preview — opens raw JSON in new tab for quick operational check */}
      <a
        href="/api/admin/compliance/reminders/preview"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
      >
        Preview reminders ↗
      </a>

      {/* Send */}
      <button
        onClick={handleSend}
        disabled={sendState === 'sending'}
        className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium shadow-sm transition-colors ${
          sendState === 'done'
            ? 'border border-green-300 bg-green-50 text-green-700'
            : sendState === 'error'
            ? 'border border-red-300 bg-red-50 text-red-700'
            : 'border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed'
        }`}
      >
        {sendState === 'sending' ? 'Sending…' : 'Send reminders'}
      </button>

      {/* Inline result */}
      {result && (
        <span className="text-xs text-on-surface-variant ml-1">
          {result.error
            ? `Error: ${result.error}`
            : result.skipped
            ? result.message ?? 'Skipped'
            : result.sent !== undefined
            ? `Sent to ${result.sent} recipient${result.sent !== 1 ? 's' : ''}`
            : ''}
        </span>
      )}
    </div>
  )
}
