'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface HrProfile {
  id: string
  // Personal
  middle_name?:  string | null
  date_of_birth?: string | null
  gender?:        string | null
  nationality?:   string | null
  // Address
  address_line_1?: string | null
  address_line_2?: string | null
  city?:           string | null
  postcode?:       string | null
  // Emergency
  emergency_contact_name?:         string | null
  emergency_contact_phone?:        string | null
  emergency_contact_relationship?: string | null
  // Employment
  employment_type?:      string | null
  contracted_hours?:     number | null
  start_date_confirmed?: boolean | null
  // Payroll
  ni_number?:       string | null
  tax_code?:        string | null
  payroll_number?:  string | null
  utr_number?:      string | null
  starter_declaration?: string | null
  // Bank
  bank_name?:           string | null
  bank_account_name?:   string | null
  bank_account_number?: string | null
  bank_sort_code?:      string | null
  // Compliance metadata
  right_to_work_checked?: boolean | null
  dbs_checked?:           boolean | null
  dbs_number?:            string | null
  dbs_expiry_date?:       string | null
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function TextInput({
  label, id, value, onChange, placeholder, type = 'text',
}: {
  label: string; id: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm text-primary focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
      />
    </div>
  )
}

function SelectInput({
  label, id, value, onChange, options,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm text-primary focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
      >
        <option value="">— select —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function CheckboxInput({
  label, id, checked, onChange,
}: {
  label: string; id: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2 pt-5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-gray-600"
      />
      <label htmlFor={id} className="text-sm text-gray-700">{label}</label>
    </div>
  )
}

export default function EditHrDetailsForm({ staff }: { staff: HrProfile }) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const init = {
    middle_name:  staff.middle_name  ?? '',
    date_of_birth: staff.date_of_birth?.slice(0, 10) ?? '',
    gender:        staff.gender        ?? '',
    nationality:   staff.nationality   ?? '',
    address_line_1: staff.address_line_1 ?? '',
    address_line_2: staff.address_line_2 ?? '',
    city:           staff.city           ?? '',
    postcode:       staff.postcode       ?? '',
    emergency_contact_name:         staff.emergency_contact_name         ?? '',
    emergency_contact_phone:        staff.emergency_contact_phone        ?? '',
    emergency_contact_relationship: staff.emergency_contact_relationship ?? '',
    employment_type:    staff.employment_type    ?? '',
    contracted_hours:   staff.contracted_hours != null ? String(staff.contracted_hours) : '',
    ni_number:          staff.ni_number          ?? '',
    tax_code:           staff.tax_code           ?? '',
    payroll_number:     staff.payroll_number     ?? '',
    utr_number:         staff.utr_number         ?? '',
    starter_declaration: staff.starter_declaration ?? '',
    bank_name:           staff.bank_name           ?? '',
    bank_account_name:   staff.bank_account_name   ?? '',
    bank_account_number: staff.bank_account_number ?? '',
    bank_sort_code:      staff.bank_sort_code      ?? '',
    dbs_number:          staff.dbs_number          ?? '',
    dbs_expiry_date:     staff.dbs_expiry_date?.slice(0, 10) ?? '',
    right_to_work_checked: staff.right_to_work_checked ?? false,
    dbs_checked:           staff.dbs_checked           ?? false,
    start_date_confirmed:  staff.start_date_confirmed  ?? false,
  }

  const [form, setForm] = useState(init)

  function set(field: keyof typeof form) {
    return (v: string | boolean) => setForm((prev) => ({ ...prev, [field]: v }))
  }

  function reset() {
    setForm(init)
    setError(null)
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    const payload: Record<string, unknown> = {
      middle_name:  form.middle_name  || null,
      date_of_birth: form.date_of_birth || null,
      gender:        form.gender        || null,
      nationality:   form.nationality   || null,
      address_line_1: form.address_line_1 || null,
      address_line_2: form.address_line_2 || null,
      city:           form.city           || null,
      postcode:       form.postcode       || null,
      emergency_contact_name:         form.emergency_contact_name         || null,
      emergency_contact_phone:        form.emergency_contact_phone        || null,
      emergency_contact_relationship: form.emergency_contact_relationship || null,
      employment_type:    form.employment_type    || null,
      contracted_hours:   form.contracted_hours   ? parseFloat(form.contracted_hours) : null,
      start_date_confirmed:  form.start_date_confirmed,
      ni_number:          form.ni_number          || null,
      tax_code:           form.tax_code           || null,
      payroll_number:     form.payroll_number     || null,
      utr_number:         form.utr_number         || null,
      starter_declaration: form.starter_declaration || null,
      bank_name:           form.bank_name           || null,
      bank_account_name:   form.bank_account_name   || null,
      bank_account_number: form.bank_account_number || null,
      bank_sort_code:      form.bank_sort_code      || null,
      dbs_number:          form.dbs_number          || null,
      dbs_expiry_date:     form.dbs_expiry_date     || null,
      right_to_work_checked: form.right_to_work_checked,
      dbs_checked:           form.dbs_checked,
    }

    try {
      const res = await fetch(`/api/admin/staff/${staff.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        setError(json.error ?? 'Failed to save HR details')
        setLoading(false)
        return
      }
      setSuccess(true)
      setLoading(false)
      router.refresh()
    } catch {
      setError('Network error — please try again')
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => { reset(); setOpen(true) }}
        className="rounded-md border border-gray-300 bg-surface-container-lowest px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Edit HR details
      </button>
    )
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Edit HR &amp; Payroll Details</h2>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Close
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">

        <Group title="Personal">
          <TextInput label="Middle name"   id="middle_name"   value={form.middle_name}   onChange={set('middle_name')} />
          <TextInput label="Date of birth" id="date_of_birth" value={form.date_of_birth} onChange={set('date_of_birth')} type="date" />
          <SelectInput
            label="Gender" id="gender" value={form.gender} onChange={set('gender')}
            options={[
              { value: 'male',             label: 'Male' },
              { value: 'female',           label: 'Female' },
              { value: 'non_binary',       label: 'Non-binary' },
              { value: 'prefer_not_to_say', label: 'Prefer not to say' },
            ]}
          />
          <TextInput label="Nationality" id="nationality" value={form.nationality} onChange={set('nationality')} />
        </Group>

        <Group title="Address">
          <div className="sm:col-span-2">
            <TextInput label="Address line 1" id="address_line_1" value={form.address_line_1} onChange={set('address_line_1')} />
          </div>
          <TextInput label="Address line 2" id="address_line_2" value={form.address_line_2} onChange={set('address_line_2')} />
          <TextInput label="City / Town"    id="city"           value={form.city}           onChange={set('city')} />
          <TextInput label="Postcode"       id="postcode"       value={form.postcode}       onChange={set('postcode')} />
        </Group>

        <Group title="Emergency Contact">
          <TextInput label="Full name"     id="ec_name"         value={form.emergency_contact_name}         onChange={set('emergency_contact_name')} />
          <TextInput label="Phone"         id="ec_phone"        value={form.emergency_contact_phone}        onChange={set('emergency_contact_phone')} />
          <TextInput label="Relationship"  id="ec_relationship" value={form.emergency_contact_relationship} onChange={set('emergency_contact_relationship')} />
        </Group>

        <Group title="Employment">
          <SelectInput
            label="Employment type" id="employment_type" value={form.employment_type} onChange={set('employment_type')}
            options={[
              { value: 'full_time',   label: 'Full time' },
              { value: 'part_time',   label: 'Part time' },
              { value: 'zero_hours',  label: 'Zero hours' },
              { value: 'agency',      label: 'Agency' },
            ]}
          />
          <TextInput label="Contracted hours / week" id="contracted_hours" value={form.contracted_hours} onChange={set('contracted_hours')} type="number" />
          <CheckboxInput label="Start date confirmed" id="start_date_confirmed" checked={form.start_date_confirmed} onChange={set('start_date_confirmed')} />
        </Group>

        <Group title="Payroll / HMRC">
          <TextInput label="NI number"           id="ni_number"          value={form.ni_number}          onChange={set('ni_number')} placeholder="AB123456C" />
          <TextInput label="Tax code"            id="tax_code"           value={form.tax_code}           onChange={set('tax_code')}  placeholder="1257L" />
          <TextInput label="Payroll number"      id="payroll_number"     value={form.payroll_number}     onChange={set('payroll_number')} />
          <TextInput label="UTR number"          id="utr_number"         value={form.utr_number}         onChange={set('utr_number')} />
          <SelectInput
            label="Starter declaration" id="starter_declaration" value={form.starter_declaration} onChange={set('starter_declaration')}
            options={[
              { value: 'A', label: 'A — This is my first job since last 6 April' },
              { value: 'B', label: 'B — This is now my only job' },
              { value: 'C', label: 'C — I have another job or pension' },
            ]}
          />
        </Group>

        <Group title="Bank Details">
          <TextInput label="Bank name"           id="bank_name"           value={form.bank_name}           onChange={set('bank_name')} />
          <TextInput label="Account holder name" id="bank_account_name"   value={form.bank_account_name}   onChange={set('bank_account_name')} />
          <TextInput label="Account number"      id="bank_account_number" value={form.bank_account_number} onChange={set('bank_account_number')} />
          <TextInput label="Sort code"           id="bank_sort_code"      value={form.bank_sort_code}      onChange={set('bank_sort_code')} placeholder="00-00-00" />
        </Group>

        <Group title="Compliance Checks">
          <CheckboxInput label="Right to work checked"   id="rtw_checked" checked={form.right_to_work_checked} onChange={set('right_to_work_checked')} />
          <CheckboxInput label="DBS check complete"      id="dbs_checked" checked={form.dbs_checked}           onChange={set('dbs_checked')} />
          <TextInput label="DBS certificate number"      id="dbs_number"      value={form.dbs_number}      onChange={set('dbs_number')} />
          <TextInput label="DBS expiry date"             id="dbs_expiry_date" value={form.dbs_expiry_date} onChange={set('dbs_expiry_date')} type="date" />
        </Group>

        {error && (
          <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
            HR details saved successfully.
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Saving…' : 'Save HR details'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-on-surface-variant hover:text-gray-700"
          >
            Cancel
          </button>
        </div>

      </form>
    </div>
  )
}
