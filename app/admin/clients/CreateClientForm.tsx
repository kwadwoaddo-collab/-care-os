'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const FUNDING_TYPES = [
  { value: 'private',        label: 'Private' },
  { value: 'local_authority', label: 'Local authority' },
  { value: 'nhs',            label: 'NHS' },
  { value: 'direct_payment', label: 'Direct payment' },
  { value: 'other',          label: 'Other' },
]

const RISK_LEVELS = [
  { value: 'low',      label: 'Low' },
  { value: 'standard', label: 'Standard' },
  { value: 'high',     label: 'High' },
  { value: 'critical', label: 'Critical' },
]

const STATUSES = [
  { value: 'active',      label: 'Active' },
  { value: 'prospective', label: 'Prospective' },
  { value: 'paused',      label: 'Paused' },
  { value: 'ended',       label: 'Ended' },
]

const emptyForm = {
  first_name:                     '',
  last_name:                      '',
  preferred_name:                 '',
  date_of_birth:                  '',
  phone:                          '',
  email:                          '',
  address_line_1:                 '',
  address_line_2:                 '',
  town_city:                      '',
  postcode:                       '',
  status:                         'active',
  care_start_date:                '',
  funding_type:                   '',
  risk_level:                     'standard',
  emergency_contact_name:         '',
  emergency_contact_phone:        '',
  emergency_contact_relationship: '',
  notes:                          '',
}

export default function CreateClientForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/clients', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name:                     form.first_name,
            last_name:                      form.last_name,
            preferred_name:                 form.preferred_name                 || null,
            date_of_birth:                  form.date_of_birth                  || null,
            phone:                          form.phone                          || null,
            email:                          form.email                          || null,
            address_line_1:                 form.address_line_1                 || null,
            address_line_2:                 form.address_line_2                 || null,
            town_city:                      form.town_city                      || null,
            postcode:                       form.postcode                       || null,
            status:                         form.status,
            care_start_date:                form.care_start_date                || null,
            funding_type:                   form.funding_type                   || null,
            risk_level:                     form.risk_level,
            emergency_contact_name:         form.emergency_contact_name         || null,
            emergency_contact_phone:        form.emergency_contact_phone        || null,
            emergency_contact_relationship: form.emergency_contact_relationship || null,
            notes:                          form.notes                          || null,
          }),
        })

        const json = await res.json() as { error?: string }
        if (!res.ok) {
          setError(json.error ?? 'Failed to create client.')
          return
        }

        setOpen(false)
        setForm(emptyForm)
        router.refresh()
      } catch {
        setError('Network error — please try again.')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        data-testid="create-client-btn"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
      >
        + Create Client
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden">

            <div className="bg-gray-50 border-b border-gray-200 px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Create client</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <form data-testid="create-client-form" onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto max-h-[80vh]">

              {/* Personal */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Personal details</legend>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">First name *</label>
                    <input
                      required
                      type="text"
                      data-testid="create-client-first-name"
                      value={form.first_name}
                      onChange={(e) => set('first_name', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Last name *</label>
                    <input
                      required
                      type="text"
                      data-testid="create-client-last-name"
                      value={form.last_name}
                      onChange={(e) => set('last_name', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Preferred name</label>
                    <input
                      type="text"
                      value={form.preferred_name}
                      onChange={(e) => set('preferred_name', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date of birth</label>
                    <input
                      type="date"
                      value={form.date_of_birth}
                      onChange={(e) => set('date_of_birth', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set('phone', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Address */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Address</legend>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Address line 1</label>
                  <input
                    type="text"
                    value={form.address_line_1}
                    onChange={(e) => set('address_line_1', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Address line 2</label>
                  <input
                    type="text"
                    value={form.address_line_2}
                    onChange={(e) => set('address_line_2', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Town / city</label>
                    <input
                      type="text"
                      value={form.town_city}
                      onChange={(e) => set('town_city', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Postcode</label>
                    <input
                      type="text"
                      value={form.postcode}
                      onChange={(e) => set('postcode', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Care & funding */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Care &amp; funding</legend>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => set('status', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Funding type</label>
                    <select
                      value={form.funding_type}
                      onChange={(e) => set('funding_type', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">— Select —</option>
                      {FUNDING_TYPES.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Risk level</label>
                    <select
                      value={form.risk_level}
                      onChange={(e) => set('risk_level', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {RISK_LEVELS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Care start date</label>
                  <input
                    type="date"
                    value={form.care_start_date}
                    onChange={(e) => set('care_start_date', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </fieldset>

              {/* Emergency contact */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Emergency contact</legend>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={form.emergency_contact_name}
                      onChange={(e) => set('emergency_contact_name', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={form.emergency_contact_phone}
                      onChange={(e) => set('emergency_contact_phone', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Relationship</label>
                  <input
                    type="text"
                    value={form.emergency_contact_relationship}
                    onChange={(e) => set('emergency_contact_relationship', e.target.value)}
                    placeholder="e.g. Daughter, Son, Spouse"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </fieldset>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="create-client-submit"
                  disabled={isPending}
                  className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPending ? 'Creating…' : 'Create client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
