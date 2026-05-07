import Link from 'next/link'
import type { PaginationMeta } from '@/lib/pagination'

type RawParams = Record<string, string | string[] | undefined>

interface Props {
  meta:         PaginationMeta
  searchParams: RawParams
}

function pageUrl(target: number, searchParams: RawParams): string {
  const params = new URLSearchParams()
  Object.entries(searchParams).forEach(([k, v]) => {
    if (k === 'page') return
    const val = Array.isArray(v) ? v[0] : v
    if (val) params.set(k, val)
  })
  params.set('page', String(target))
  return `?${params.toString()}`
}

const LINK_CLS =
  'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors'

export default function Pagination({ meta, searchParams }: Props) {
  if (meta.totalPages <= 1) return null

  const { page, totalPages, total, pageSize } = meta

  // Show up to 5 page numbers centred on current page
  const start = Math.max(1, page - 2)
  const end   = Math.min(totalPages, start + 4)
  const pages: number[] = []
  for (let i = start; i <= end; i++) pages.push(i)

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
      <span>
        Showing {from}–{to} of {total} result{total !== 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-1">
        {meta.hasPrev && (
          <Link href={pageUrl(page - 1, searchParams)} className={LINK_CLS}>
            ← Prev
          </Link>
        )}
        {pages.map((p) => (
          <Link
            key={p}
            href={pageUrl(p, searchParams)}
            className={[
              LINK_CLS,
              p === page ? 'bg-gray-900 text-white ring-gray-900 hover:bg-gray-800' : 'bg-white text-gray-700',
            ].join(' ')}
          >
            {p}
          </Link>
        ))}
        {meta.hasNext && (
          <Link href={pageUrl(page + 1, searchParams)} className={LINK_CLS}>
            Next →
          </Link>
        )}
      </div>
    </div>
  )
}
