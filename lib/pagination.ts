type SearchParamValue = string | string[] | undefined

function str(v: SearchParamValue): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
}

export interface PaginationMeta {
  total:      number
  page:       number
  pageSize:   number
  totalPages: number
  hasNext:    boolean
  hasPrev:    boolean
}

export function getPaginationParams(
  params: Record<string, SearchParamValue>
): { page: number; pageSize: number } {
  const page     = Math.max(1, parseInt(str(params.page)     || '1',  10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(str(params.pageSize) || '20', 10) || 20))
  return { page, pageSize }
}

export function getRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1
  return { from, to }
}

export function buildPaginationMeta(
  total:    number,
  page:     number,
  pageSize: number
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return { total, page, pageSize, totalPages, hasNext: page < totalPages, hasPrev: page > 1 }
}

/** Pull a single string value from page searchParams */
export function sp(
  params: Record<string, SearchParamValue>,
  key:    string
): string {
  return str(params[key])
}
