import assert from 'node:assert/strict'
import { readFile } from 'fs/promises'
import path from 'path'
import { PDFDocument, clip, endPath, popGraphicsState, pushGraphicsState, rectangle, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { createCanvas } from '@napi-rs/canvas'
import {
  UnsafeStampLayoutError,
  buildStampText,
  chooseStampLayout,
  isRevisionHistoryText,
  stampUncontrolledPdf,
  shouldUseUncontrolledCopy,
} from './uncontrolled-pdf'

const input = {
  audience: 'viewer' as const,
  variant: 'preview' as const,
  requestedPath: 'documents/doc-1/current.pdf',
  officialPath: 'documents/doc-1/current.pdf',
  type: 'QP',
  status: 'Published',
  mimeType: 'application/pdf',
  fileName: 'QP-LAB-01.pdf',
}

assert.equal(shouldUseUncontrolledCopy(input), true)
assert.equal(shouldUseUncontrolledCopy({ ...input, audience: 'staff' }), false)
assert.equal(shouldUseUncontrolledCopy({ ...input, type: 'Form' }), false)
assert.equal(shouldUseUncontrolledCopy({ ...input, status: 'Draft' }), false)
assert.equal(shouldUseUncontrolledCopy({ ...input, requestedPath: 'documents/doc-1/source.docx' }), false)

assert.equal(buildStampText('preview', '12/07/2026'), 'เอกสารไม่ควบคุม / UNCONTROLLED DOCUMENT')
assert.equal(
  buildStampText('download', '12/07/2026'),
  'เอกสารไม่ควบคุม / UNCONTROLLED DOCUMENT - Downloaded on: 12/07/2026',
)

assert.equal(isRevisionHistoryText('CARS_PORTAL_REVISION_HISTORY'), true)
assert.equal(isRevisionHistoryText('แบบบันทึกประวัติการแก้ไข / ทบทวนเอกสาร'), true)
assert.equal(isRevisionHistoryText('Fm-QP-LAB-01/03'), true)
assert.equal(isRevisionHistoryText('5.0 ระเบียบปฏิบัติงาน'), false)

assert.deepEqual(
  chooseStampLayout({ variant: 'preview', pageWidthPt: 595.28, firstInkTopMm: 15.5 }),
  { fontSizePt: 18, baselineTopMm: 12 },
)
assert.deepEqual(
  chooseStampLayout({ variant: 'download', pageWidthPt: 595.28, firstInkTopMm: 15.5 }),
  { fontSizePt: 16, baselineTopMm: 12 },
)
assert.equal(
  chooseStampLayout({ variant: 'download', pageWidthPt: 535, firstInkTopMm: 15.5 }).fontSizePt < 16,
  true,
)
assert.throws(
  () => chooseStampLayout({ variant: 'download', pageWidthPt: 595.28, firstInkTopMm: 8 }),
  UnsafeStampLayoutError,
)

async function buildSourcePdf() {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(await readFile(path.join(
    process.cwd(), 'node_modules', 'font-th-sarabun-new', 'fonts', 'THSarabunNew_bold-webfont.ttf',
  )))
  const contentPage = pdf.addPage([595.28, 841.89])
  contentPage.pushOperators(
    pushGraphicsState(),
    rectangle(0, 0, 595.28, 841.89),
    clip(),
    endPath(),
  )
  contentPage.drawText('Original content', { x: 48, y: 790, size: 12, font, color: rgb(0, 0, 0) })
  contentPage.pushOperators(popGraphicsState())
  const imageCanvas = createCanvas(12, 12)
  const imageContext = imageCanvas.getContext('2d')
  imageContext.fillStyle = '#000'
  imageContext.fillRect(0, 0, 12, 12)
  const imageOnlyPage = pdf.addPage([595.28, 841.89])
  imageOnlyPage.drawImage(await pdf.embedPng(imageCanvas.toBuffer('image/png')), {
    x: 48, y: 720, width: 12, height: 12,
  })
  const landscapePage = pdf.addPage([841.89, 595.28])
  landscapePage.drawText('Landscape content', { x: 48, y: 540, size: 12, font, color: rgb(0, 0, 0) })
  const historyPage = pdf.addPage([595.28, 841.89])
  historyPage.drawText('CARS_PORTAL_REVISION_HISTORY', { x: 48, y: 790, size: 12, font, color: rgb(1, 1, 1) })
  const legacyHistoryPage = pdf.addPage([595.28, 841.89])
  legacyHistoryPage.drawText('แบบบันทึกประวัติการแก้ไข', { x: 48, y: 790, size: 12, font, color: rgb(0, 0, 0) })
  return pdf.save()
}

async function testTransform() {
  const transformed = await stampUncontrolledPdf(await buildSourcePdf(), {
    variant: 'download',
    downloadDate: '12/07/2026',
  })
  assert.equal(transformed.stampedPages, 3)
  assert.equal(transformed.skippedHistoryPages, 2)
  assert.equal(transformed.fontSizes.every((size) => size >= 13.5 && size <= 16), true)
  assert.equal(transformed.horizontalScales.length, 3)
  assert.equal(transformed.horizontalScales[0] < 1, true)
  assert.equal(
    transformed.text,
    'เอกสารไม่ควบคุม / UNCONTROLLED DOCUMENT - Downloaded on: 12/07/2026',
  )
}

void testTransform()
