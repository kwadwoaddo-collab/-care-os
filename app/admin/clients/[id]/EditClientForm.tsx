'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Client {
  id:                             string
  first_name:                     string
  last_name:                      string
  preferred_name:                 string | null
  date_of_birth:                  string | null
  phone:                          string | null
  email:                          string | null
  address_line_1:                 string | null
  address_line_2:                 string | null
  town_city:                      string | null
  postcode:                       string | null
  status:                         string
  care_start_date:                string | null
  care_end_date:                  string | null
  funding_type:                   string | null
  risk_level:                     string
  emergency_contact_name:         string | null
  emergency_contact_phone:        string | null
  emergency_contact_relationship: string | null
  notes:                          string | null
}

const FUNDING_TYPES = [
  { value: 'private',         label: 'Private' },
  { value: 'local_authority', label: 'Local authority' },
  { value: 'nhs',             label: 'NHS' },
  { value: 'direct_payment',  label: 'Direct payment' },
  { value: 'other',           label: 'Other' },
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

export default function EditClientForm({ client }: { client: Client }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    first_name:                     client.first_name,
    last_name:                      client.last_name,
    preferred_name:                 client.preferred_name                 ?? '',
    date_of_birth:                  client.date_of_birth                  ?? '',
    phone:                          client.phone                          ?? '',
    email:                          client.email                          ?? '',
    address_line_1:                 client.address_line_1                 ?? '',
    address_line_2:                 client.address_line_2                 ?? '',
    town_city:                      client.town_city                      ?? '',
    postcode:                       client.postcode                       ?? '',
    status:                         client.status,
    care_start_date:                client.care_start_date                ?? '',
    care_end_date:                  client.care_end_date                  ?? '',
    funding_type:                   client.funding_type                   ?? '',
    risk_level:                     client.risk_level,
    emergency_contact_name:         client.emergency_contact_name         ?? '',
    emergency_contact_phone:        client.emergency_contact_phone        ?? '',
    emergency_contact_relationship: client.emergency_contact_relationship ?? '',
    notes:                          client.notes                          ?? '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/clients/${client.id}`, {
          method:  'PATCH',
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
            care_end_date:                  form.care_end_date                  || null,
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
          setError(json.error ?? 'Failed to update client.')
          return
        }

        setOpen(false)
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
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-md border border-gray-300 bg-surface-container-lowest px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl bg-surface-container-lowest rounded-xl shadow-xl overflow-hidden">

            <div className="bg-gray-50 border-b border-gray-200 px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Edit client</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto max-h-[80vh]">

              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Personal details</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">First name *</label>
                    <input required type="text" value={form.first_name} onChange={(e) => set('first_name', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Last name *</label>
                    <input required type="text" value={form.last_name} onChange={(e) => set('last_name', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Preferred name</label>
                    <input type="text" value={form.preferred_name} onChange={(e) => set('preferred_name', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date of birth</label>
                    <input type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                    <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Address</legend>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Address line 1</label>
                  <input type="text" value={form.address_line_1} onChange={(e) => set('address_line_1', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Address line 2</label>
                  <input type="text" value={form.address_line_2} onChange={(e) => set('address_line_2', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Town / city</label>
                    <input type="text" value={form.town_city} onChange={(e) => set('town_city', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Postcode</label>
                    <input type="text" value={form.postcode} onChange={(e) => set('postcode', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Care &amp; funding</legend>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select value={form.status} onChange={(e) => set('status', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Funding type</label>
                    <select value={form.funding_type} onChange={(e) => set('funding_type', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">— Select —</option>
                      {FUNDING_TYPES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Risk level</label>
                    <select value={form.risk_level} onChange={(e) => set('risk_level', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {RISK_LEVELS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Care start date</label>
                    <input type="date" value={form.care_start_date} onChange={(e) => set('care_start_date', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Care end date</label>
                    <input type="date" value={form.care_end_date} onChange={(e) => set('care_end_date', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Emergency contact</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                    <input type="text" value={form.emergency_contact_name} onChange={(e) => set('emergency_contact_name', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                    <input type="tel" value={form.emergency_contact_phone} onChange={(e) => set('emergency_contact_phone', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Relationship</label>
                  <input type="text" value={form.emergency_contact_relationship} onChange={(e) => set('emergency_contact_relationship', e.target.value)}
                    placeholder="e.g. Daughter, Son, Spouse"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </fieldset>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:text-primary transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isPending}
                  className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {isPending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
