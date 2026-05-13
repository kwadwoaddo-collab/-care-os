'use client'

import { useState } from 'react'

interface Props {
  staffProfileId:  string
  lastReviewedAt:  string | null | undefined
  lastReviewedBy:  string | null | undefined
  lastReviewNotes: string | null | undefined
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function ComplianceReviewSection({
  staffProfileId,
  lastReviewedAt,
  lastReviewedBy,
  lastReviewNotes,
}: Props) {
  const [editing,    setEditing]    = useState(false)
  const [reviewedBy, setReviewedBy] = useState(lastReviewedBy ?? '')
  const [notes,      setNotes]      = useState(lastReviewNotes ?? '')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [reviewedAt, setReviewedAt] = useState(lastReviewedAt)
  const [saved,      setSaved]      = useState(false)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/staff/${staffProfileId}/review`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reviewed_by: reviewedBy, notes }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? 'Save failed')
      }
      const data = await res.json() as { last_reviewed_at?: string }
      setReviewedAt(data.last_reviewed_at ?? null)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Last compliance review</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            {reviewedAt ? 'Update' : 'Add review'}
          </button>
        )}
      </div>

      <div className="p-4">
        {!editing ? (
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <dt className="text-xs font-medium text-on-surface-variant">Reviewed at</dt>
              <dd className="mt-0.5 text-sm text-primary">{formatDate(reviewedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-on-surface-variant">Reviewed by</dt>
              <dd className="mt-0.5 text-sm text-primary">{reviewedBy || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-on-surface-variant">Notes</dt>
              <dd className="mt-0.5 text-sm text-primary">{notes || '—'}</dd>
            </div>
          </dl>
        ) : (
          <div className="space-y-3 max-w-lg">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Reviewed by
              </label>
              <input
                type="text"
                value={reviewedBy}
                onChange={(e) => setReviewedBy(e.target.value)}
                placeholder="Name of reviewer"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any notes about this compliance review"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save review'}
              </button>
              <button
                onClick={() => { setEditing(false); setError(null) }}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {saved && (
          <p className="text-xs text-green-600 mt-2">Review saved.</p>
        )}
      </div>
    </div>
  )
}
