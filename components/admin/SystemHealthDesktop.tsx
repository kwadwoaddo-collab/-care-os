'use client'

import React, { useState } from 'react'
import type { SystemHealthData } from './SystemHealthMobile'

function StatusPill({ ok, label }: { ok: boolean; label?: string }) {
  if (ok) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-green-50 text-green-700 border border-green-200 shrink-0">
        {label || 'OK'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-red-50 text-red-700 border border-red-200 shrink-0">
      {label || 'ERR'}
    </span>
  )
}

function ToggleSwitch({ enabled, onChange, label, description }: { enabled: boolean, onChange: () => void, label: string, description: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-bold text-[#1e293b]">{label}</p>
        <p className="text-xs font-medium text-slate-500 mt-0.5">{description}</p>
      </div>
      <button 
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:ring-offset-2 ${enabled ? 'bg-[#4f46e5]' : 'bg-slate-200'}`}
        role="switch"
        aria-checked={enabled}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

export default function SystemHealthDesktop({ data }: { data: SystemHealthData }) {
  const { health, appUrl, supaUrl } = data
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [verboseLogging, setVerboseLogging] = useState(true)

  // Mock telemetry data
  const uptime = health?.database ? '99.98%' : '98.40%'
  const dbLoad = health?.database ? '42%' : '89%'
  const apiLatency = health?.database ? '12ms' : '145ms'

  const mockLogs = [
    { id: 1, level: 'INFO', msg: 'System initialization complete.', time: '00:00:01' },
    { id: 2, level: 'SYNC', msg: 'Started background worker: ShiftReconciliation', time: '00:02:15' },
    { id: 3, level: 'INFO', msg: 'Database connection pool active (max: 20)', time: '00:02:16' },
    { id: 4, level: 'AUTH', msg: 'Token validation success for user_id=e78a...', time: '00:05:42' },
    { id: 5, level: 'WARN', msg: 'High memory usage detected on worker node A', time: '00:14:09' },
    { id: 6, level: 'AUTH', msg: 'Failed login attempt from IP 192.168.1.4', time: '00:15:22' },
    { id: 7, level: 'SYNC', msg: 'Document OCR processing completed in 1.4s', time: '00:18:05' },
    { id: 8, level: 'INFO', msg: 'API request /admin/staff/921 OK (4ms)', time: '00:19:33' },
    { id: 9, level: 'INFO', msg: 'Heartbeat received from all nodes.', time: '00:20:00' },
  ]

  function getLogColor(level: string) {
    switch(level) {
      case 'INFO': return 'text-green-400'
      case 'AUTH': return 'text-blue-400'
      case 'WARN': return 'text-yellow-400'
      case 'SYNC': return 'text-indigo-400'
      default: return 'text-slate-400'
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
      
      {/* ── Main Column (Left) ────────────────────────────────────────────── */}
      <div className="xl:col-span-2 flex flex-col gap-6">
        
        {/* KPI Monitoring Grid */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-green-600 text-[24px]">schedule</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Uptime (30d)</p>
              <h2 className="text-2xl font-bold text-[#1e293b] mt-1">{uptime}</h2>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-blue-600 text-[24px]">bolt</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">API Latency</p>
              <h2 className="text-2xl font-bold text-[#1e293b] mt-1">{apiLatency}</h2>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#4f46e5] text-[24px]">database</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Database Load</p>
              <h2 className="text-2xl font-bold text-[#1e293b] mt-1">{dbLoad}</h2>
            </div>
          </div>
        </div>

        {/* Core Services Connectivity */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-[#f8f9fa]">
            <h2 className="text-sm font-bold text-[#1e293b]">Core Services & Connectivity</h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">Real-time health and response metrics</p>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Service</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Endpoint URL</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Response</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-bold text-[#1e293b]">PostgreSQL Cluster</td>
                <td className="px-6 py-4 text-xs font-mono font-medium text-slate-500">{supaUrl.replace('https://', '').split('.')[0]}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-600">12ms</td>
                <td className="px-6 py-4"><StatusPill ok={health?.database ?? false} label="OPERATIONAL" /></td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-bold text-[#1e293b]">Document Storage</td>
                <td className="px-6 py-4 text-xs font-mono font-medium text-slate-500">s3://care-os-documents</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-600">28ms</td>
                <td className="px-6 py-4"><StatusPill ok={health?.storage ?? false} label="OPERATIONAL" /></td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-bold text-[#1e293b]">App Routing (Next.js)</td>
                <td className="px-6 py-4 text-xs font-mono font-medium text-slate-500">{appUrl}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-600">8ms</td>
                <td className="px-6 py-4"><StatusPill ok={health?.appUrlConfigured ?? false} label="OPERATIONAL" /></td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-bold text-[#1e293b]">Email Dispatcher</td>
                <td className="px-6 py-4 text-xs font-mono font-medium text-slate-500">api.resend.com/emails</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-600">45ms</td>
                <td className="px-6 py-4"><StatusPill ok={health?.resendConfigured ?? false} label="OPERATIONAL" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Environment Control */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-[#f8f9fa]">
            <h2 className="text-sm font-bold text-[#1e293b]">Environment Control</h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">Manage runtime behavioral flags</p>
          </div>
          <div className="px-6 py-2 divide-y divide-slate-100">
            <ToggleSwitch 
              label="Maintenance Mode" 
              description="Disables external traffic and routes users to a maintenance screen." 
              enabled={maintenanceMode} 
              onChange={() => setMaintenanceMode(!maintenanceMode)} 
            />
            <ToggleSwitch 
              label="Verbose Logging" 
              description="Streams detailed debug information to STDOUT and the logging provider." 
              enabled={verboseLogging} 
              onChange={() => setVerboseLogging(!verboseLogging)} 
            />
          </div>
        </div>

      </div>

      {/* ── Console Column (Right) ─────────────────────────────────────────── */}
      <div className="bg-[#0f172a] rounded-xl border border-[#1e293b] shadow-xl flex flex-col overflow-hidden h-[600px] xl:h-auto">
        
        {/* Console Header */}
        <div className="px-4 py-3 border-b border-[#1e293b] flex items-center justify-between bg-[#0b1121]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400 text-[16px]">terminal</span>
            <span className="text-xs font-bold text-slate-300 tracking-wider">LIVE EVENT STREAM</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-[10px] font-bold text-green-500 uppercase">Streaming</span>
          </div>
        </div>

        {/* Console Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[11px] leading-relaxed">
          {mockLogs.map(log => (
            <div key={log.id} className="flex gap-3 hover:bg-[#1e293b]/30 px-1 py-0.5 rounded transition-colors">
              <span className="text-slate-500 shrink-0">{log.time}</span>
              <span className={`font-bold shrink-0 w-[45px] ${getLogColor(log.level)}`}>[{log.level}]</span>
              <span className="text-slate-300 break-all">{log.msg}</span>
            </div>
          ))}
          <div className="flex gap-3 px-1 py-0.5">
            <span className="text-slate-500 shrink-0">00:20:05</span>
            <span className="text-slate-500 animate-pulse">_</span>
          </div>
        </div>

        {/* Console Footer Action */}
        <div className="p-4 border-t border-[#1e293b] bg-[#0b1121]">
          <button className="w-full py-2 bg-[#1e293b] hover:bg-[#334155] text-white text-xs font-bold rounded shadow-sm transition-colors uppercase tracking-wider">
            View Full Console Logs
          </button>
        </div>

      </div>

    </div>
  )
}
