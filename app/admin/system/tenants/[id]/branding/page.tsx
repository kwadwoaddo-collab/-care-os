'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface BrandingData {
  company_name:  string
  logo_url:      string
  accent_colour: string
  email_from:    string
  login_tagline: string
}

const DEFAULTS: BrandingData = {
  company_name:  '',
  logo_url:      '',
  accent_colour: '#4f46e5',
  email_from:    '',
  login_tagline: '',
}

export default function BrandingPage() {
  const { id } = useParams<{ id: string }>()
  const [form,    setForm]    = useState<BrandingData>(DEFAULTS)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/system/tenants/${id}/branding`)
      .then(r => r.json())
      .then(d => {
        if (d.branding) {
          setForm({
            company_name:  d.branding.company_name  ?? '',
            logo_url:      d.branding.logo_url      ?? '',
            accent_colour: d.branding.accent_colour ?? '#4f46e5',
            email_from:    d.branding.email_from    ?? '',
            login_tagline: d.branding.login_tagline ?? '',
          })
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  function set<K extends keyof BrandingData>(key: K, value: BrandingData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch(`/api/admin/system/tenants/${id}/branding`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><span className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Link href={`/admin/system/tenants/${id}`} className="hover:text-indigo-600">Tenant</Link>
          <span>/</span>
          <span>Branding</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Tenant Branding</h1>
        <p className="text-sm text-slate-500 mt-1">Customise the look and feel for this care company&apos;s portal.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">Branding saved successfully.</div>}

      {/* Live preview */}
      <div
        className="rounded-xl p-6 text-white"
        style={{ backgroundColor: form.accent_colour }}
      >
        <div className="flex items-center gap-3">
          {form.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logo_url} alt="Logo" className="h-10 w-10 rounded-lg object-cover bg-white/20" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center font-bold text-lg">
              {(form.company_name || 'Co').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-bold text-lg leading-none">{form.company_name || 'Company Name'}</p>
            {form.login_tagline && <p className="text-white/80 text-sm mt-0.5">{form.login_tagline}</p>}
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-slate-200 rounded-xl p-6 space-y-5">
        <Field label="Company Name (display override)">
          <input type="text" value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="e.g. Sunrise Care Ltd" className="input" />
          <p className="text-xs text-slate-400 mt-1">Shown in the portal header and branded emails.</p>
        </Field>

        <Field label="Logo URL">
          <input type="url" value={form.logo_url} onChange={e => set('logo_url', e.target.value)} placeholder="https://..." className="input" />
          <p className="text-xs text-slate-400 mt-1">Must be a publicly accessible image URL (PNG or SVG preferred).</p>
        </Field>

        <Field label="Accent Colour">
          <div className="flex items-center gap-3">
            <input type="color" value={form.accent_colour} onChange={e => set('accent_colour', e.target.value)} className="h-10 w-16 rounded border border-slate-300 cursor-pointer" />
            <input
              type="text"
              value={form.accent_colour}
              onChange={e => set('accent_colour', e.target.value)}
              pattern="^#[0-9a-fA-F]{6}$"
              className="input w-32"
              placeholder="#4f46e5"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">Used for the branded login screen, navigation, and worker portal.</p>
        </Field>

        <Field label="Branded Email From">
          <input type="email" value={form.email_from} onChange={e => set('email_from', e.target.value)} placeholder="noreply@yourcompany.com" className="input" />
          <p className="text-xs text-slate-400 mt-1">Overrides the default sender for this tenant&apos;s outgoing emails.</p>
        </Field>

        <Field label="Login Page Tagline">
          <input type="text" value={form.login_tagline} onChange={e => set('login_tagline', e.target.value)} placeholder="e.g. Quality Care, Delivered Safely" className="input" />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <Link href={`/admin/system/tenants/${id}`} className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Back to tenant
        </Link>
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
        >
          {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          Save Branding
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
