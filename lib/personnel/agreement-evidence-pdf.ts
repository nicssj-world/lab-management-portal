import { createHash } from 'crypto'
import { readFile } from 'fs/promises'
import path from 'path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

type DocumentSnapshot = { code: string; title: string; revision: string | null; sha256: string }
type AgreementEvidenceInput = {
  fiscalYear: number
  employeeName: string
  employeePosition?: string | null
  acceptedAt: string
  agreementDocument: DocumentSnapshot
  disclosureDocument: DocumentSnapshot
  disclosure: {
    hasActivity: boolean
    activityName?: string | null
    activityDate?: string | null
    place?: string | null
    impacts?: string[]
    impactNotes?: string | null
  }
  signingMethod: 'drawn' | 'saved'
  signaturePng?: Uint8Array | null
  approver?: {
    name: string
    position?: string | null
    approvedAt: string
    signaturePng?: Uint8Array | null
  }
}

export const AGREEMENT_TEMPLATE_PATH = path.join(process.cwd(), 'assets', 'personnel', 'agreements', 'Fm-QP-LAB-27-01.pdf')
export const DISCLOSURE_TEMPLATE_PATH = path.join(process.cwd(), 'assets', 'personnel', 'agreements', 'Fm-QP-LAB-27-02.pdf')

const AGREEMENT_TEMPLATE_SHA256 = '58738d96ccbb1d80aeebc7125b0e641d0c23dd4816c999d05101f39b4102e82c'
const DISCLOSURE_TEMPLATE_SHA256 = '4d223ce40e4395c76c56ad255ea4b9ac02b8ba2619540de793081dda7609458e'
const FORM_NAME_FONT_SIZE = 10
const FORM_DATE_FONT_SIZE = 9
const FORM_POSITION_FONT_SIZE = 10.5
const BLACK = rgb(0, 0, 0)
const WHITE = rgb(1, 1, 1)

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function loadVerifiedTemplate(filePath: string, expectedHash: string) {
  const bytes = await readFile(filePath)
  if (sha256(bytes) !== expectedHash) throw new Error(`แม่แบบ PDF ถูกเปลี่ยนแปลง: ${path.basename(filePath)}`)
  return bytes
}

async function loadThaiFont(pdf: PDFDocument) {
  pdf.registerFontkit(fontkit)
  const fontPath = path.join(process.cwd(), 'node_modules', 'font-th-sarabun-new', 'fonts', 'THSarabunNew-webfont.ttf')
  return pdf.embedFont(await readFile(fontPath))
}

function fitSize(font: PDFFont, value: string, width: number, preferred = 13, minimum = 8) {
  let size = preferred
  while (size > minimum && font.widthOfTextAtSize(value, size) > width) size -= 0.5
  return size
}

function drawFilledValue(page: PDFPage, font: PDFFont, value: string, box: { x: number; y: number; width: number; height?: number }, preferredSize = 13, align: 'left' | 'center' = 'left') {
  const text = value.trim() || '-'
  const height = box.height ?? 15
  const size = fitSize(font, text, box.width - 4, preferredSize)
  const textWidth = font.widthOfTextAtSize(text, size)
  const textX = align === 'center' ? box.x + Math.max(2, (box.width - textWidth) / 2) : box.x + 2
  page.drawRectangle({ x: box.x, y: box.y - 2, width: box.width, height, color: WHITE })
  page.drawText(text, { x: textX, y: box.y + 1, font, size, color: BLACK })
}

function thaiDateParts(value: string) {
  const parts = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric',
  }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '-'
  return { day: part('day'), month: part('month'), year: part('year') }
}

function drawDateOnForm(page: PDFPage, font: PDFFont, acceptedAt: string, y: number, x = 124) {
  const date = thaiDateParts(acceptedAt)
  const value = `วันที่ ${date.day} ${date.month} ${date.year}`
  const box = { x, y: y - 5, width: 160, height: 21 }
  const size = fitSize(font, value, box.width - 4, FORM_DATE_FONT_SIZE)
  const textWidth = font.widthOfTextAtSize(value, size)
  page.drawRectangle({ ...box, color: WHITE })
  page.drawText(value, {
    x: box.x + (box.width - textWidth) / 2,
    y: y + 1,
    font,
    size,
    color: BLACK,
  })
}

async function drawSignature(pdf: PDFDocument, page: PDFPage, signaturePng: Uint8Array | null | undefined, x: number, y: number) {
  if (!signaturePng?.length) return
  const image = await pdf.embedPng(signaturePng)
  const scale = Math.min(112 / image.width, 38 / image.height)
  const width = image.width * scale
  const height = image.height * scale
  page.drawImage(image, { x: x + (112 - width) / 2, y, width, height })
}

function drawSignerName(page: PDFPage, font: PDFFont, value: string, x: number, y: number, width = 142) {
  const name = value.trim() || '-'
  drawFilledValue(page, font, `(${name})`, { x, y, width, height: 19 }, FORM_NAME_FONT_SIZE, 'center')
}

function drawSignerPosition(page: PDFPage, font: PDFFont, value: string | null | undefined, x: number, y: number) {
  drawFilledValue(page, font, value || '-', { x, y, width: 160, height: 19 }, FORM_POSITION_FONT_SIZE, 'center')
}

async function fillEmployeeBlock(pdf: PDFDocument, page: PDFPage, font: PDFFont, input: AgreementEvidenceInput, signatureY: number, nameY: number, positionY: number, dateY: number) {
  await drawSignature(pdf, page, input.signaturePng, 153, signatureY)
  drawSignerName(page, font, input.employeeName, 144, nameY)
  drawSignerPosition(page, font, input.employeePosition, 124, positionY)
  drawDateOnForm(page, font, input.acceptedAt, dateY)
}

async function fillApproverBlock(pdf: PDFDocument, page: PDFPage, font: PDFFont, approver: AgreementEvidenceInput['approver'], signatureY: number, nameY: number, positionY: number, dateY: number) {
  if (!approver) return
  await drawSignature(pdf, page, approver.signaturePng, 348, signatureY)
  drawSignerName(page, font, approver.name, 340, nameY, 160)
  drawSignerPosition(page, font, approver.position, 344, positionY)
  drawDateOnForm(page, font, approver.approvedAt, dateY, 347)
}

function drawImpactCheck(page: PDFPage, y: number) {
  page.drawLine({ start: { x: 106.8, y: y + 4 }, end: { x: 110.3, y: y + 0.7 }, thickness: 1.25, color: BLACK })
  page.drawLine({ start: { x: 110.3, y: y + 0.7 }, end: { x: 116.1, y: y + 9 }, thickness: 1.25, color: BLACK })
}

async function appendDisclosureForm(pdf: PDFDocument, templateBytes: Uint8Array, font: PDFFont, input: AgreementEvidenceInput) {
  const disclosurePdf = await PDFDocument.load(templateBytes)
  const [page] = await pdf.copyPages(disclosurePdf, [0])
  pdf.addPage(page)

  drawFilledValue(page, font, input.disclosure.activityName || '-', { x: 326, y: 687, width: 137 }, 12)
  drawFilledValue(page, font, input.disclosure.activityDate || '-', { x: 331, y: 652, width: 148 }, 12)
  drawFilledValue(page, font, input.disclosure.place || '-', { x: 161, y: 618, width: 280 }, 12)

  const impactY: Record<string, number> = { ability: 549, integrity: 514.5, fairness: 480, decision: 445.5 }
  for (const impact of input.disclosure.impacts ?? []) {
    if (impactY[impact] !== undefined) drawImpactCheck(page, impactY[impact])
  }

  await fillEmployeeBlock(pdf, page, font, input, 266, 239, 215, 190)
  await fillApproverBlock(pdf, page, font, input.approver, 266, 239, 215, 190)
}

export async function generateAgreementEvidencePdf(input: AgreementEvidenceInput) {
  const [agreementTemplate, disclosureTemplate] = await Promise.all([
    loadVerifiedTemplate(AGREEMENT_TEMPLATE_PATH, AGREEMENT_TEMPLATE_SHA256),
    loadVerifiedTemplate(DISCLOSURE_TEMPLATE_PATH, DISCLOSURE_TEMPLATE_SHA256),
  ])

  // Load Fm-QP-LAB-27/01 itself as the output document so its two original pages,
  // wording, layout, watermark, form code and footer remain untouched.
  const pdf = await PDFDocument.load(agreementTemplate)
  const font = await loadThaiFont(pdf)
  const agreementPages = pdf.getPages()
  if (agreementPages.length !== 2) throw new Error('แม่แบบ Fm-QP-LAB-27/01 ต้องมี 2 หน้า')

  await fillEmployeeBlock(pdf, agreementPages[1], font, input, 601, 574, 550, 525)
  await fillApproverBlock(pdf, agreementPages[1], font, input.approver, 601, 574, 550, 525)
  if (input.disclosure.hasActivity) await appendDisclosureForm(pdf, disclosureTemplate, font, input)

  return pdf.save({ useObjectStreams: false })
}
