// Lightweight offline action queue backed by localStorage.
// Actions are stored and replayed when the device comes back online.

export interface QueuedAction {
  id:        string
  url:       string
  method:    string
  body:      string
  queued_at: string
  label:     string
}

const KEY = 'worker_offline_queue'

function readQueue(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as QueuedAction[]
  } catch {
    return []
  }
}

function writeQueue(queue: QueuedAction[]): void {
  localStorage.setItem(KEY, JSON.stringify(queue))
}

export function enqueue(action: Omit<QueuedAction, 'id' | 'queued_at'>): string {
  const id  = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const q   = readQueue()
  q.push({ ...action, id, queued_at: new Date().toISOString() })
  writeQueue(q)
  return id
}

export function dequeue(id: string): void {
  writeQueue(readQueue().filter(a => a.id !== id))
}

export function getQueue(): QueuedAction[] {
  return readQueue()
}

export function clearQueue(): void {
  localStorage.removeItem(KEY)
}

export async function flushQueue(): Promise<{ flushed: number; failed: number }> {
  const queue = readQueue()
  let flushed = 0
  let failed  = 0
  const flushedIds = new Set<string>()

  for (const action of queue) {
    try {
      const res = await fetch(action.url, {
        method:  action.method,
        headers: { 'Content-Type': 'application/json' },
        body:    action.body,
      })
      if (res.ok) {
        flushedIds.add(action.id)
        flushed++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  if (flushed > 0) {
    writeQueue(readQueue().filter(a => !flushedIds.has(a.id)))
  }

  return { flushed, failed }
}
