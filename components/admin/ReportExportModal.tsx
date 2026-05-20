'use client'

import { useState } from 'react'

export type ReportType = 'compliance' | 'workforce' | 'incidents'

export function ReportExportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [selectedReport, setSelectedReport] = useState<ReportType>('compliance')
  const [isExporting, setIsExporting] = useState(false)

  if (!isOpen) return null

  const handleExport = () => {
    setIsExporting(true)
    
    // For now, only Compliance snapshot is wired up
    if (selectedReport === 'compliance') {
      window.location.href = '/api/admin/compliance/export'
    } else {
      alert('This report type is not yet wired up. Please select CQC Compliance Snapshot.')
    }
    
    setTimeout(() => {
      setIsExporting(false)
      onClose()
    }, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10">
            <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-[20px]">
              analytics
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-primary tracking-tight" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
              Export Data
            </h3>
            <p className="text-sm text-on-surface-variant">
              Generate and download reports in CSV format.
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <label 
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              selectedReport === 'compliance' 
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10' 
                : 'border-outline-variant hover:bg-surface-container-low'
            }`}
          >
            <div className="flex items-center h-5">
              <input 
                type="radio" 
                name="report_type" 
                value="compliance"
                checked={selectedReport === 'compliance'}
                onChange={() => setSelectedReport('compliance')}
                className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-600"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-primary">CQC Compliance Snapshot</span>
              <span className="text-xs text-on-surface-variant">Complete overview of staff training, credentials, and expiry dates.</span>
            </div>
          </label>

          <label 
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              selectedReport === 'workforce' 
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10' 
                : 'border-outline-variant hover:bg-surface-container-low'
            }`}
          >
            <div className="flex items-center h-5">
              <input 
                type="radio" 
                name="report_type" 
                value="workforce"
                checked={selectedReport === 'workforce'}
                onChange={() => setSelectedReport('workforce')}
                className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-600"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-primary">Workforce Capacity (Coming Soon)</span>
              <span className="text-xs text-on-surface-variant">Staff availability and shift assignment statistics.</span>
            </div>
          </label>

          <label 
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              selectedReport === 'incidents' 
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10' 
                : 'border-outline-variant hover:bg-surface-container-low'
            }`}
          >
            <div className="flex items-center h-5">
              <input 
                type="radio" 
                name="report_type" 
                value="incidents"
                checked={selectedReport === 'incidents'}
                onChange={() => setSelectedReport('incidents')}
                className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-600"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-primary">Incident Logs (Coming Soon)</span>
              <span className="text-xs text-on-surface-variant">All logged incidents and safeguarding reports over time.</span>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-primary hover:bg-surface-container-low transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExport}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white hover:from-indigo-500 hover:to-violet-500 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                Generating...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download CSV
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
