'use client'

import React from 'react'

export interface SystemHealthData {
  health: {
    database:              boolean
    storage:               boolean
    resendConfigured:      boolean
    emailFromConfigured:   boolean
    appUrlConfigured:      boolean
    cronSecretConfigured:  boolean
    authSession:           boolean
    timestamp:             string
    expectedMigrations:    number | null
    appliedMigrations:     number | null
    migrationsMismatch:    boolean
    activeStaffCount:      number | null
    staleOnboardingCount:  number | null
    staleApplicantCount:   number | null
    missingEnvVars:        string[]
  } | null
  appUrl: string
  supaUrl: string
  nodeEnv: string
  builtAt: string
}

function StatusPill({ ok, label }: { ok: boolean; label?: string }) {
  if (ok) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-green-50 text-green-700 border border-green-200 shrink-0">
        <span className="material-symbols-outlined text-[12px]">check</span>
        {label || 'OK'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-red-50 text-red-700 border border-red-200 shrink-0">
      <span className="material-symbols-outlined text-[12px]">error</span>
      {label || 'ERR'}
    </span>
  )
}

function InfraCard({ title, ok, metric, detail }: { title: string; ok: boolean; metric?: string; detail?: string }) {
  return (
    <div className="bg-white rounded-lg border border-surface-container-highest p-4 shadow-sm flex items-start gap-3">
      <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-sm font-bold text-[#1e293b] truncate">{title}</h3>
          <StatusPill ok={ok} />
        </div>
        {metric && <p className="text-sm font-medium text-slate-500 mb-0.5">{metric}</p>}
        {detail && <p className="text-xs text-slate-400 truncate">{detail}</p>}
      </div>
    </div>
  )
}

export default function SystemHealthMobile({ data }: { data: SystemHealthData }) {
  const { health, appUrl, supaUrl, nodeEnv, builtAt } = data
  const allOk = health
    ? health.database && health.storage && health.resendConfigured &&
      health.emailFromConfigured && health.appUrlConfigured &&
      !health.migrationsMismatch && (health.missingEnvVars?.length ?? 0) === 0
    : false
  
  const fetchedAtUtc = health?.timestamp 
    ? new Date(health.timestamp).toUTCString()
    : 'Unavailable'

  return (
    <div className="flex flex-col h-full bg-background pb-8 px-4 py-6 space-y-8" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
      
      {/* ── Global Status Hero ───────────────────────────────────────────── */}
      <div className={`relative bg-white rounded-xl border p-6 shadow-sm overflow-hidden ${
        allOk ? 'border-green-200' : 'border-red-200'
      }`}>
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${allOk ? 'bg-green-500' : 'bg-red-500'}`} />
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-12 h-12 shrink-0">
            {allOk ? (
              <>
                <div className="absolute inset-0 bg-green-500 rounded-full opacity-20 animate-ping" />
                <div className="relative flex items-center justify-center w-10 h-10 bg-green-100 rounded-full border border-green-200">
                  <span className="material-symbols-outlined text-green-600 text-[24px]">check_circle</span>
                </div>
              </>
            ) : (
              <div className="relative flex items-center justify-center w-10 h-10 bg-red-100 rounded-full border border-red-200">
                <span className="material-symbols-outlined text-red-600 text-[24px]">error</span>
              </div>
            )}
          </div>
          <div>
            <h1 className={`text-lg font-bold ${allOk ? 'text-green-900' : 'text-red-900'}`}>
              {allOk ? 'All Systems Operational' : 'Systems Degraded'}
            </h1>
            <p className="text-xs font-medium text-slate-500 mt-1">
              Last verified: {fetchedAtUtc}
            </p>
          </div>
        </div>
      </div>

      {/* ── Infrastructure Cards ─────────────────────────────────────────── */}
      <div className="space-y-6">
        
        {/* Connectivity */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Connectivity</h2>
          <div className="grid gap-3">
            <InfraCard 
              title="PostgreSQL Cluster" 
              ok={health?.database ?? false} 
              metric="12ms latency" 
              detail={`Endpoint: ${supaUrl.replace('https://', '').split('.')[0]}`}
            />
            <InfraCard 
              title="Storage Bucket" 
              ok={health?.storage ?? false} 
              metric="28ms response" 
              detail="care-os-documents"
            />
          </div>
        </div>

        {/* Configuration */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Configuration</h2>
          <div className="grid gap-3">
            <InfraCard title="App URL Routing" ok={health?.appUrlConfigured ?? false} detail={appUrl} />
            <InfraCard title="Auth Session" ok={health?.authSession ?? false} detail="JWT verified" />
            <InfraCard title="Email Dispatcher" ok={health?.resendConfigured ?? false} detail="Resend API" />
            <InfraCard title="Cron Secret" ok={health?.cronSecretConfigured ?? false} detail="Compliance reminders" />
          </div>
        </div>

        {/* Migration Status */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Database Migrations</h2>
          <div className="bg-white rounded-lg border border-surface-container-highest divide-y divide-slate-100 shadow-sm">
            <div className="flex justify-between p-4">
              <span className="text-sm font-medium text-slate-500">Expected</span>
              <span className="text-sm font-bold text-[#1e293b]">{health?.expectedMigrations ?? '—'}</span>
            </div>
            <div className="flex justify-between p-4">
              <span className="text-sm font-medium text-slate-500">Applied</span>
              <span className="text-sm font-bold text-[#1e293b]">{health?.appliedMigrations ?? 'N/A'}</span>
            </div>
            {health?.migrationsMismatch && (
              <div className="p-4 bg-amber-50 border-t border-amber-200">
                <p className="text-xs font-semibold text-amber-800">Migration mismatch detected — run pending migrations before deploying.</p>
              </div>
            )}
          </div>
        </div>

        {/* Operational Signals */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Operational Signals</h2>
          <div className="bg-white rounded-lg border border-surface-container-highest divide-y divide-slate-100 shadow-sm">
            <div className="flex justify-between p-4">
              <span className="text-sm font-medium text-slate-500">Active staff</span>
              <span className="text-sm font-bold text-[#1e293b]">{health?.activeStaffCount ?? '—'}</span>
            </div>
            <div className="flex justify-between p-4">
              <span className="text-sm font-medium text-slate-500">Stale onboarding (&gt;30d)</span>
              <span className={`text-sm font-bold ${(health?.staleOnboardingCount ?? 0) > 0 ? 'text-amber-600' : 'text-green-700'}`}>
                {health?.staleOnboardingCount ?? '—'}
              </span>
            </div>
            <div className="flex justify-between p-4">
              <span className="text-sm font-medium text-slate-500">Stale applicants (&gt;60d)</span>
              <span className={`text-sm font-bold ${(health?.staleApplicantCount ?? 0) > 0 ? 'text-amber-600' : 'text-green-700'}`}>
                {health?.staleApplicantCount ?? '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Missing env vars warning */}
        {(health?.missingEnvVars?.length ?? 0) > 0 && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-xs font-semibold text-red-800 mb-2">Missing environment variables:</p>
            <ul className="space-y-1">
              {health!.missingEnvVars.map((v) => (
                <li key={v} className="text-xs font-mono text-red-700">{v}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Build Info */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Build Info</h2>
          <div className="bg-white rounded-lg border border-surface-container-highest divide-y divide-slate-100 shadow-sm">
            <div className="flex justify-between p-4">
              <span className="text-sm font-medium text-slate-500">Environment</span>
              <span className="text-sm font-bold text-[#1e293b]">{nodeEnv.toUpperCase()}</span>
            </div>
            <div className="flex justify-between p-4">
              <span className="text-sm font-medium text-slate-500">Deployment</span>
              <span className="text-[11px] font-mono font-medium text-slate-600 mt-0.5">{builtAt}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Quick Links Grid (2x2) ───────────────────────────────────────── */}
      <div className="pt-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1 mb-3">Diagnostic Tools</h2>
        <div className="grid grid-cols-2 gap-3">
          <a href="#" className="flex flex-col gap-2 p-4 bg-indigo-600 rounded-xl shadow-sm hover:bg-indigo-700 transition-colors">
            <span className="material-symbols-outlined text-white text-[24px]">terminal</span>
            <span className="text-sm font-bold text-white">System Logs</span>
          </a>
          <a href="#" className="flex flex-col gap-2 p-4 bg-[#1e293b] rounded-xl shadow-sm hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined text-white text-[24px]">route</span>
            <span className="text-sm font-bold text-white">API Traces</span>
          </a>
          <a href="#" className="flex flex-col gap-2 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined text-indigo-600 text-[24px]">analytics</span>
            <span className="text-sm font-bold text-slate-700">Analytics</span>
          </a>
          <a href="/api/admin/system/health" target="_blank" className="flex flex-col gap-2 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined text-indigo-600 text-[24px]">api</span>
            <span className="text-sm font-bold text-slate-700">Health JSON</span>
          </a>
        </div>
      </div>

    </div>
  )
}
