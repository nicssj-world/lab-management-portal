import { readFile } from 'fs/promises'
import path from 'path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, concatTransformationMatrix, popGraphicsState, pushGraphicsState, rgb } from 'pdf-lib'

export type DeliveryVariant = 'preview' | 'download'
export type UncontrolledAudience = 'viewer' | 'public' | 'staff'

export const UNCONTROLLED_TRANSFORM_VERSION = 'uncontrolled-v2'
export const PREVIEW_TEXT = 'เอกสารไม่ควบคุม / UNCONTROLLED DOCUMENT'
export const DOWNLOAD_PREFIX = 'เอกสารไม่ควบคุม / UNCONTROLLED DOCUMENT - Downloaded on: '

// Types whose public/viewer copies get the uncontrolled stamp. `Manual` (MN-) is
// deliberately absent: those are uploaded as-is with no system cover, so they are
// delivered like Form/Reference/Card file. The Quality Manual is its own `QM` type
// and stays eligible.
export const ELIGIBLE_TYPES = new Set(['QM', 'QP', 'WI'])
const BASELINE_TOP_MM = 12
const SIDE_MARGIN_MM = 12
const MIN_DOWNLOAD_FONT_SIZE_PT = 13.5
// Preview needs headroom below its requested 18pt for the same reason download does:
// a page even a fraction narrower than exact A4 (e.g. 595pt, or 595.276pt from a
// 210mm sheet) scales the text down slightly, and without a floor that is rejected.
const MIN_PREVIEW_FONT_SIZE_PT = 15
const A4_WIDTH_PT = 595.28
const MM_TO_PT = 72 / 25.4

export class UnsafeStampLayoutError extends Error {
  readonly code = 'UNCONTROLLED_STAMP_UNSAFE_PAGE'

  constructor() {
    super('พื้นที่ว่างด้านบนของเอกสารไม่เพียงพอสำหรับ Stamp')
  }
}

export function buildStampText(variant: DeliveryVariant, downloadDate: string) {
  return variant === 'preview' ? PREVIEW_TEXT : `${DOWNLOAD_PREFIX}${downloadDate}`
}

export function shouldUseUncontrolledCopy(input: {
  audience: UncontrolledAudience
  variant: DeliveryVariant
  requestedPath: string
  officialPath: string | null
  type: string | null
  status: string | null
  mimeType: string | null
  fileName: string | null
}) {
  if (input.audience === 'staff') return false
  if (input.requestedPath !== input.officialPath) return false
  if (input.status !== 'Published' || !ELIGIBLE_TYPES.has(input.type ?? '')) return false

  const mime = input.mimeType?.toLowerCase() ?? ''
  return mime.includes('pdf') || /\.pdf$/i.test(input.fileName ?? input.requestedPath)
}

function normalizeHistoryText(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s*-\s*/g, '-')
    .trim()
}

export function isRevisionHistoryText(text: string) {
  const normalized = normalizeHistoryText(text)
  return normalized.includes('cars_portal_revision_history')
    || normalized.includes('แบบบันทึกประวัติการแก้ไข')
    || normalized.includes('fm-qp-lab-01/03')
}

export function chooseStampLayout(input: {
  variant: DeliveryVariant
  pageWidthPt: number
  firstInkTopMm: number
}) {
  const requestedSize = input.variant === 'preview' ? 18 : 16
  const minSize = input.variant === 'preview' ? MIN_PREVIEW_FONT_SIZE_PT : MIN_DOWNLOAD_FONT_SIZE_PT
  const horizontalScale = Math.min(
    1,
    Math.max(0, (input.pageWidthPt - 2 * SIDE_MARGIN_MM * MM_TO_PT) / (A4_WIDTH_PT - 2 * SIDE_MARGIN_MM * MM_TO_PT)),
  )
  const verticalMax = ((input.firstInkTopMm - 6) * MM_TO_PT) / 1.15
  const fontSizePt = Math.min(requestedSize * horizontalScale, verticalMax)

  if (fontSizePt < minSize) throw new UnsafeStampLayoutError()
  return { fontSizePt, baselineTopMm: BASELINE_TOP_MM }
}

function firstInkTopPt(data: Uint8ClampedArray, width: number, height: number) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      if (data[offset] < 245 || data[offset + 1] < 245 || data[offset + 2] < 245) {
        return y
      }
    }
  }
  return Number.POSITIVE_INFINITY
}

async function renderFirstInkTopMm(pdfjsPage: any, CanvasFactory: any) {
  const viewport = pdfjsPage.getViewport({ scale: 1 })
  const drawingContext = new CanvasFactory().create(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const { canvas, context } = drawingContext
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  await pdfjsPage.render({ canvasContext: context, viewport, canvas }).promise
  const firstInk = firstInkTopPt(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)
  return Number.isFinite(firstInk) ? firstInk / MM_TO_PT : Number.POSITIVE_INFINITY
}

export async function stampUncontrolledPdf(
  source: Uint8Array | Buffer,
  input: { variant: DeliveryVariant; downloadDate: string },
) {
  const pdf = await PDFDocument.load(source, { ignoreEncryption: true })
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(await readFile(path.join(
    process.cwd(), 'node_modules', 'font-th-sarabun-new', 'fonts', 'THSarabunNew_bold-webfont.ttf',
  )))
  const sourceBytes = new Uint8Array(source)
  const { createIsomorphicCanvasFactory, getDocumentProxy } = await import('unpdf')
  const CanvasFactory = await createIsomorphicCanvasFactory(() => import('@napi-rs/canvas'))
  const pdfjs = await getDocumentProxy(sourceBytes, { CanvasFactory })
  const pages = pdf.getPages()
  const text = buildStampText(input.variant, input.downloadDate)
  const fontSizes: number[] = []
  const horizontalScales: number[] = []
  let stampedPages = 0
  let skippedHistoryPages = 0

  try {
    for (let index = 0; index < pages.length; index += 1) {
      const pdfjsPage = await pdfjs.getPage(index + 1)
      const textContent = await pdfjsPage.getTextContent()
      const pageText = textContent.items
        .filter((item): item is typeof item & { str: string } => 'str' in item)
        .map((item) => item.str)
        .join(' ')
      if (isRevisionHistoryText(pageText)) {
        skippedHistoryPages += 1
        continue
      }

      const firstInkMm = await renderFirstInkTopMm(pdfjsPage, CanvasFactory)
      const page = pages[index]
      const crop = page.getCropBox()
      const layout = chooseStampLayout({
        variant: input.variant,
        pageWidthPt: crop.width,
        firstInkTopMm: firstInkMm,
      })
      const maxWidth = crop.width - 2 * SIDE_MARGIN_MM * MM_TO_PT
      const naturalWidth = font.widthOfTextAtSize(text, layout.fontSizePt)
      const horizontalScale = Math.min(1, maxWidth / naturalWidth)
      const centerX = crop.x + crop.width / 2
      if (horizontalScale < 1) {
        page.pushOperators(
          pushGraphicsState(),
          concatTransformationMatrix(horizontalScale, 0, 0, 1, centerX * (1 - horizontalScale), 0),
        )
      }
      page.drawText(text, {
        x: crop.x + (crop.width - naturalWidth) / 2,
        y: crop.y + crop.height - layout.baselineTopMm * MM_TO_PT,
        size: layout.fontSizePt,
        font,
        color: rgb(1, 0.35, 0.35),
      })
      if (horizontalScale < 1) page.pushOperators(popGraphicsState())
      stampedPages += 1
      fontSizes.push(layout.fontSizePt)
      horizontalScales.push(horizontalScale)
    }
  } finally {
    await pdfjs.destroy()
  }

  return {
    bytes: await pdf.save(),
    text,
    stampedPages,
    skippedHistoryPages,
    fontSizes,
    horizontalScales,
  }
}
