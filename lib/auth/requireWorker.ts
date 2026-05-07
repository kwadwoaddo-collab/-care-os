import 'server-only'

import { validateWorkerToken, type WorkerProfile } from '@/lib/worker/auth'
import { unauthorized } from '@/lib/auth/responses'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkerContext {
  staffProfileId: string
  companyId:      string
  role:           'care_worker'
  worker:         WorkerProfile
}

export type WorkerResult =
  | { ok: true;  ctx: WorkerContext }
  | { ok: false; response: Response }

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Validate worker portal token and return scoped context.
 *
 * Usage in route handlers:
 * ```ts
 * const auth = await requireWorker(token)
 * if (!auth.ok) return auth.response
 * const { staffProfileId, companyId } = auth.ctx
 * ```
 */
export async function requireWorker(
  token: string | null | undefined
): Promise<WorkerResult> {
  const result = await validateWorkerToken(token)

  if (!result.ok) {
    return {
      ok: false,
      response: unauthorized(result.error),
    }
  }

  return {
    ok: true,
    ctx: {
      staffProfileId: result.worker.id,
      companyId:      result.worker.company_id,
      role:           'care_worker',
      worker:         result.worker,
    },
  }
}
