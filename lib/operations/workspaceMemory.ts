'use client'

// Coordinator workspace memory — localStorage persistence for per-user preferences.
// All keys are namespaced under 'care-os:occ:*' to avoid collisions.
// Reads return safe defaults when localStorage is unavailable (SSR or private mode).

const PREFIX = 'care-os:occ'

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(`${PREFIX}:${key}`)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function safeWrite<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value))
  } catch {
    // Storage quota exceeded or disabled — silently ignore
  }
}

// ── Focus mode ─────────────────────────────────────────────────────────────────

export function getFocusMode(): boolean {
  return safeRead('focus-mode', false)
}

export function setFocusMode(enabled: boolean): void {
  safeWrite('focus-mode', enabled)
}

// ── Queue preferences ──────────────────────────────────────────────────────────

export interface QueuePrefs {
  filterPriority: string
  filterCategory: string
  filterStatus:   string
  sortBy:         'priority' | 'due_date' | 'created_at'
}

const QUEUE_DEFAULTS: QueuePrefs = {
  filterPriority: '',
  filterCategory: '',
  filterStatus:   'open',
  sortBy:         'priority',
}

export function getQueuePrefs(): QueuePrefs {
  return safeRead<QueuePrefs>('queue-prefs', QUEUE_DEFAULTS)
}

export function setQueuePrefs(prefs: Partial<QueuePrefs>): void {
  const current = getQueuePrefs()
  safeWrite('queue-prefs', { ...current, ...prefs })
}

// ── Collapsed sections ─────────────────────────────────────────────────────────

export function getSectionCollapsed(section: string): boolean {
  const all = safeRead<Record<string, boolean>>('collapsed-sections', {})
  return all[section] ?? false
}

export function toggleSectionCollapsed(section: string): boolean {
  const all = safeRead<Record<string, boolean>>('collapsed-sections', {})
  const next = !all[section]
  safeWrite('collapsed-sections', { ...all, [section]: next })
  return next
}

// ── Preferred tab ──────────────────────────────────────────────────────────────

export function getPreferredTab(namespace: string, fallback: string): string {
  return safeRead<string>(`tab:${namespace}`, fallback)
}

export function setPreferredTab(namespace: string, tab: string): void {
  safeWrite(`tab:${namespace}`, tab)
}
