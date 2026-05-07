import 'server-only'

import { NextResponse } from 'next/server'

/** 401 — not authenticated */
export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}

/** 403 — authenticated but insufficient permissions */
export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 })
}

/** 404 — resource not found */
export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 })
}
