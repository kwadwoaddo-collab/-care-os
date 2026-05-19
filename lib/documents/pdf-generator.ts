import 'server-only'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PdfField {
  label: string
  value: string
}

export interface PdfSection {
  title: string
  fields: PdfField[]
}

export interface ApplicationFormPdfData {
  applicantName:  string
  email:          string
  jobRole:        string
  phone:          string
  submittedAt:    string
  companyName:    string
  sections:       PdfSection[]
}

// ── Layout constants ──────────────────────────────────────────────────────────

const PAGE_WIDTH  = 595   // A4 points
const PAGE_HEIGHT = 842
const MARGIN      = 50
const CONTENT_W   = PAGE_WIDTH - MARGIN * 2

const BRAND_COLOR   = rgb(0.239, 0.231, 0.651)  // indigo-700 approximation
const GRAY_DARK     = rgb(0.1, 0.1, 0.1)
const GRAY_MID      = rgb(0.4, 0.4, 0.4)
const GRAY_LIGHT    = rgb(0.85, 0.85, 0.85)

const FONT_TITLE     = 18
const FONT_SECTION   = 11
const FONT_LABEL     = 9
const FONT_VALUE     = 9
const FONT_SMALL     = 8
const LINE_HEIGHT    = 13

// ── Layout state ──────────────────────────────────────────────────────────────

class LayoutState {
  page!:    PDFPage
  y:        number = 0
  bold!:    PDFFont
  regular!: PDFFont

  constructor(
    private doc: PDFDocument,
    bold: PDFFont,
    regular: PDFFont,
  ) {
    this.bold    = bold
    this.regular = regular
    this.newPage()
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.y    = PAGE_HEIGHT - MARGIN
  }

  ensureSpace(needed: number) {
    if (this.y - needed < MARGIN + 20) {
      this.newPage()
    }
  }

  drawText(
    text: string,
    opts: {
      font?:  PDFFont
      size?:  number
      color?: ReturnType<typeof rgb>
      x?:     number
      indent?: number
    } = {}
  ) {
    const font   = opts.font  ?? this.regular
    const size   = opts.size  ?? FONT_VALUE
    const color  = opts.color ?? GRAY_DARK
    const x      = opts.x ?? (opts.indent ? MARGIN + opts.indent : MARGIN)
    this.page.drawText(text, { x, y: this.y, font, size, color })
    this.y -= LINE_HEIGHT
  }

  moveDown(pts = LINE_HEIGHT) {
    this.y -= pts
  }

  drawHRule(color = GRAY_LIGHT, thickness = 0.5) {
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end:   { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness,
      color,
    })
    this.y -= 6
  }

  // Wraps text into multiple lines respecting content width
  wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = text.split(/\s+/)
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      const w = font.widthOfTextAtSize(candidate, size)
      if (w > maxWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    if (current) lines.push(current)
    return lines.length ? lines : ['']
  }

  drawWrapped(
    text: string,
    opts: {
      font?:   PDFFont
      size?:   number
      color?:  ReturnType<typeof rgb>
      indent?: number
      maxW?:   number
    } = {}
  ) {
    const font    = opts.font  ?? this.regular
    const size    = opts.size  ?? FONT_VALUE
    const color   = opts.color ?? GRAY_DARK
    const indent  = opts.indent ?? 0
    const maxW    = opts.maxW ?? (CONTENT_W - indent)
    const x       = MARGIN + indent
    const lines   = this.wrapText(text, font, size, maxW)
    for (const line of lines) {
      this.ensureSpace(LINE_HEIGHT + 4)
      this.page.drawText(line, { x, y: this.y, font, size, color })
      this.y -= LINE_HEIGHT
    }
  }
}

// ── Value formatter ───────────────────────────────────────────────────────────

function formatValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '—'
  if (typeof raw === 'string') return raw.trim() || '—'
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No'
  if (typeof raw === 'number') return String(raw)
  if (Array.isArray(raw)) {
    if (raw.length === 0) return '—'
    return raw
      .map((item, i) => {
        if (typeof item === 'object' && item !== null) {
          return `${i + 1}. ` + Object.entries(item as Record<string, unknown>)
            .filter(([, v]) => v !== null && v !== '' && v !== undefined)
            .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${formatValue(v)}`)
            .join(' | ')
        }
        return `${i + 1}. ${formatValue(item)}`
      })
      .join('\n')
  }
  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== '' && v !== undefined)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${formatValue(v)}`)
      .join('\n')
  }
  return String(raw)
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateApplicationFormPdf(data: ApplicationFormPdfData): Promise<Uint8Array> {
  const doc     = await PDFDocument.create()
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)

  const layout = new LayoutState(doc, bold, regular)

  // ── Cover header ────────────────────────────────────────────────────────────

  // Brand stripe
  layout.page.drawRectangle({
    x: 0, y: PAGE_HEIGHT - 80,
    width: PAGE_WIDTH, height: 80,
    color: BRAND_COLOR,
  })

  layout.page.drawText('Care OS', {
    x: MARGIN, y: PAGE_HEIGHT - 32,
    font: bold, size: 14, color: rgb(1, 1, 1),
  })
  layout.page.drawText('Staff File — Application Form', {
    x: MARGIN, y: PAGE_HEIGHT - 50,
    font: regular, size: 10, color: rgb(0.85, 0.85, 1),
  })
  layout.page.drawText(data.companyName, {
    x: MARGIN, y: PAGE_HEIGHT - 66,
    font: regular, size: 9, color: rgb(0.75, 0.75, 0.95),
  })

  layout.y = PAGE_HEIGHT - 96

  // ── Applicant summary box ────────────────────────────────────────────────────

  layout.page.drawRectangle({
    x: MARGIN - 6, y: layout.y - 56,
    width: CONTENT_W + 12, height: 68,
    color: rgb(0.97, 0.97, 1),
    borderColor: rgb(0.8, 0.8, 0.95),
    borderWidth: 0.5,
  })

  layout.y -= 10

  layout.page.drawText(data.applicantName, {
    x: MARGIN, y: layout.y,
    font: bold, size: FONT_TITLE, color: BRAND_COLOR,
  })
  layout.y -= 14

  const metaItems = [
    data.email,
    data.phone || '',
    `Role: ${data.jobRole || '—'}`,
    `Submitted: ${data.submittedAt}`,
  ].filter(Boolean)

  layout.page.drawText(metaItems.join('   ·   '), {
    x: MARGIN, y: layout.y,
    font: regular, size: FONT_SMALL, color: GRAY_MID,
  })

  layout.y -= 18
  layout.page.drawText('CONFIDENTIAL — Management only. Not for distribution.', {
    x: MARGIN, y: layout.y,
    font: bold, size: 7, color: rgb(0.7, 0.3, 0.3),
  })

  layout.y -= 22

  // ── Sections ─────────────────────────────────────────────────────────────────

  for (const section of data.sections) {
    if (!section.fields.some(f => f.value && f.value !== '—')) continue

    layout.ensureSpace(LINE_HEIGHT * 4)

    // Section header
    layout.page.drawRectangle({
      x: MARGIN - 6, y: layout.y - 2,
      width: CONTENT_W + 12, height: LINE_HEIGHT + 6,
      color: rgb(0.95, 0.95, 1),
    })
    layout.page.drawRectangle({
      x: MARGIN - 6, y: layout.y - 2,
      width: 3, height: LINE_HEIGHT + 6,
      color: BRAND_COLOR,
    })
    layout.drawText(section.title.toUpperCase(), {
      font: bold, size: FONT_SECTION, color: BRAND_COLOR,
    })
    layout.moveDown(4)

    // Fields
    for (const field of section.fields) {
      if (!field.value || field.value === '—') continue

      const valueLines = field.value.split('\n')
      const totalLines = valueLines.reduce((sum, vl) => {
        const wrapped = layout.wrapText(vl || ' ', regular, FONT_VALUE, CONTENT_W - 90)
        return sum + Math.max(1, wrapped.length)
      }, 0)
      const needed = totalLines * LINE_HEIGHT + LINE_HEIGHT + 6

      layout.ensureSpace(needed)

      // Label
      layout.drawText(field.label, {
        font: bold, size: FONT_LABEL, color: GRAY_MID,
      })
      layout.y += LINE_HEIGHT - 2

      // Value (right side, wrapping)
      for (const vl of valueLines) {
        layout.drawWrapped(vl || ' ', {
          font: regular, size: FONT_VALUE, color: GRAY_DARK,
          indent: 90, maxW: CONTENT_W - 90,
        })
      }

      layout.moveDown(3)
    }

    layout.moveDown(8)
    layout.drawHRule()
    layout.moveDown(4)
  }

  // ── Footer on last page ──────────────────────────────────────────────────────

  const pages = doc.getPages()
  const lastPage = pages[pages.length - 1]
  lastPage.drawText(`Generated by Care OS  ·  ${new Date().toISOString()}`, {
    x: MARGIN, y: MARGIN - 10,
    font: regular, size: 7, color: GRAY_MID,
  })
  lastPage.drawText(`Page ${pages.length} of ${pages.length}`, {
    x: PAGE_WIDTH - MARGIN - 60, y: MARGIN - 10,
    font: regular, size: 7, color: GRAY_MID,
  })

  return doc.save()
}
