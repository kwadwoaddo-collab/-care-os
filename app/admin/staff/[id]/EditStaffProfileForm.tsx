'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface StaffProfile {
  id:         string
  first_name: string | null
  last_name:  string | null
  email:      string | null
  phone:      string | null
  job_role:   string | null
  job_title:  string | null
  status:     string
  start_date: string | null
}

const STATUSES = [
  { value: 'pre_employment', label: 'Pre-employment' },
  { value: 'active',         label: 'Active' },
  { value: 'suspended',      label: 'Suspended' },
  { value: 'inactive',       label: 'Inactive' },
  { value: 'terminated',     label: 'Terminated' },
] as const

export default function EditStaffProfileForm({ staff }: { staff: StaffProfile }) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    first_name: staff.first_name ?? '',
    last_name:  staff.last_name  ?? '',
    email:      staff.email      ?? '',
    phone:      staff.phone      ?? '',
    job_role:   staff.job_role ?? staff.job_title ?? '',
    start_date: staff.start_date?.slice(0, 10) ?? '',
    status:     staff.status,
  })

  function openModal() {
    setForm({
      first_name: staff.first_name ?? '',
      last_name:  staff.last_name  ?? '',
      email:      staff.email      ?? '',
      phone:      staff.phone      ?? '',
      job_role:   staff.job_role ?? staff.job_title ?? '',
      start_date: staff.start_date?.slice(0, 10) ?? '',
      status:     staff.status,
    })
    setError(null)
    setSuccess(false)
    setOpen(true)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError(null)
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/admin/staff/${staff.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          first_name: form.first_name,
          last_name:  form.last_name,
          email:      form.email,
          phone:      form.phone      || null,
          job_role:   form.job_role   || null,
          start_date: form.start_date || null,
          status:     form.status,
        }),
      })

      const data = (await res.json()) as { error?: string }

      if (!res.ok) {
        setError(data.error ?? 'Failed to save changes')
        return
      }

      setSuccess(true)
      router.refresh()
      setTimeout(() => {
        setOpen(false)
        setSuccess(false)
      }, 1200)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
      >
        <span className="material-symbols-outlined text-[18px]">edit</span>
        Edit Profile
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">

            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold text-primary">Edit Staff Profile</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    First name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="first_name"
                    value={form.first_name}
                    onChange={handleChange}
                    required
                    className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Last name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="last_name"
                    value={form.last_name}
                    onChange={handleChange}
                    required
                    className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Job role</label>
                <input
                  name="job_role"
                  value={form.job_role}
                  onChange={handleChange}
                  className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start date</label>
                  <input
                    name="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={handleChange}
                    className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              )}
              {success && (
                <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Profile updated.</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Save changes'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  )
}
