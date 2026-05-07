'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

export interface SelectOption {
  value: string
  label: string
}

export interface FilterField {
  type:         'text' | 'select' | 'date'
  name:         string
  label:        string
  placeholder?: string
  options?:     SelectOption[]
}

interface Props {
  fields: FilterField[]
}

const INPUT_CLS =
  'rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white'

export default function ListFilters({ fields }: Props) {
  const router                       = useRouter()
  const sp                           = useSearchParams()
  const [, startTransition]          = useTransition()

  // Local state only for text inputs (selects navigate immediately)
  const [textValues, setTextValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    fields.filter((f) => f.type === 'text').forEach((f) => {
      init[f.name] = sp.get(f.name) ?? ''
    })
    return init
  })

  function buildUrl(overrides: Record<string, string>): string {
    const params = new URLSearchParams(sp.toString())
    params.delete('page') // always reset to page 1 when filters change
    Object.entries(overrides).forEach(([k, v]) => {
      if (v) params.set(k, v)
      else   params.delete(k)
    })
    return `?${params.toString()}`
  }

  function navigate(overrides: Record<string, string>) {
    startTransition(() => router.push(buildUrl(overrides)))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate(textValues)
  }

  function handleSelectChange(name: string, value: string) {
    navigate({ [name]: value })
  }

  const hasActive = fields.some((f) => !!sp.get(f.name))

  function clearAll() {
    const overrides: Record<string, string> = {}
    fields.forEach((f) => { overrides[f.name] = '' })
    setTextValues((prev) => {
      const next = { ...prev }
      fields.filter((f) => f.type === 'text').forEach((f) => { next[f.name] = '' })
      return next
    })
    navigate(overrides)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
      {fields.map((field) => {
        if (field.type === 'text') {
          return (
            <input
              key={field.name}
              type="text"
              name={field.name}
              value={textValues[field.name] ?? ''}
              onChange={(e) =>
                setTextValues((prev) => ({ ...prev, [field.name]: e.target.value }))
              }
              placeholder={field.placeholder ?? field.label}
              className={`${INPUT_CLS} w-48`}
            />
          )
        }
        if (field.type === 'select') {
          return (
            <select
              key={field.name}
              name={field.name}
              value={sp.get(field.name) ?? ''}
              onChange={(e) => handleSelectChange(field.name, e.target.value)}
              className={`${INPUT_CLS} pr-8`}
            >
              <option value="">{field.label}: All</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )
        }
        if (field.type === 'date') {
          return (
            <div key={field.name} className="flex flex-col">
              <label className="text-[10px] font-medium text-gray-500 mb-0.5">{field.label}</label>
              <input
                type="date"
                name={field.name}
                value={sp.get(field.name) ?? ''}
                onChange={(e) => handleSelectChange(field.name, e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          )
        }
        return null
      })}

      <button
        type="submit"
        className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
      >
        Search
      </button>

      {hasActive && (
        <button
          type="button"
          onClick={clearAll}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
        >
          Clear
        </button>
      )}
    </form>
  )
}
