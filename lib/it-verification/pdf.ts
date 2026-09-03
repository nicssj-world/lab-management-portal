import path from 'node:path'
import { readFile } from 'node:fs/promises'
import fontkit from '@pdf-lib/fontkit'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { VERIFICATION_FORM_CODE, VERIFICATION_FORM_DISPLAY_CODE } from './domain'
import type { VerificationRoundDetail, VerificationSample } from './types'

const OFFICIAL_PAGE = { width: 860.87, height: 665.22 }
const BLACK = rgb(0.08, 0.1, 0.14)
const MUTED = rgb(0.35, 0.39, 0.46)
const LINE = rgb(0.55, 0.58, 0.63)
const LIGHT = rgb(0.96, 0.97, 0.98)

type Fonts = { regular: PDFFont; bold: PDFFont }

async function getFonts(pdf: PDFDocument): Promise<Fonts> {
  pdf.registerFontkit(fontkit)
  const base = path.join(process.cwd(), 'node_modules', 'font-th-sarabun-new', 'fonts')
  const [regular, bold] = await Promise.all([
    readFile(path.join(base, 'THSarabunNew-webfont.ttf')),
    readFile(path.join(base, 'THSarabunNew_bold-webfont.ttf')),
  ])
  return { regular: await pdf.embedFont(regular), bold: await pdf.embedFont(bold) }
}

async function loadOfficialTemplate(): Promise<{ pdf: PDFDocument; revision: string | null; effectiveDate: string | null; officialLoaded: boolean }> {
  const { data: document } = await supabaseAdmin
    .from('documents')
    .select('file_url, revision, effective_date')
    .eq('document_code', VERIFICATION_FORM_CODE)
    .eq('status', 'Published')
    .is('deleted_at', null)
    .maybeSingle()

  if (document?.file_url) {
    try {
      const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: document.file_url }))
      if (object.Body && typeof object.Body.transformToByteArray === 'function') {
        return {
          pdf: await PDFDocument.load(await object.Body.transformToByteArray()),
          revision: document.revision ?? null,
          effectiveDate: document.effective_date ?? null,
          officialLoaded: true,
        }
      }
    } catch (error) {
      console.warn('Could not load official IT verification template; using compatible fallback', error)
    }
  }

  return { pdf: await PDFDocument.create(), revision: document?.revision ?? null, effectiveDate: document?.effective_date ?? null, officialLoaded: false }
}

function fitText(text: string, font: PDFFont, size: number, width: number) {
  let result = text
  while (result.length > 1 && font.widthOfTextAtSize(result, size) > width) result = `${result.slice(0, -2)}…`
  return result
}

function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size = 13, color = BLACK) {
  page.drawText(text, { x, y, font, size, color })
}

function resultMark(result: VerificationSample['lis_to_his']) {
  return result === 'pass' ? 'P' : result === 'fail' ? 'X' : result === 'na' ? 'N/A' : '-'
}

function drawFallbackForm(page: PDFPage, detail: VerificationRoundDetail, fonts: Fonts, revision: string | null, effectiveDate: string | null) {
  const { round, samples } = detail
  if (!round) return
  const width = page.getWidth()
  const height = page.getHeight()
  drawText(page, 'บันทึกการตรวจสอบความถูกต้องของการส่งผ่านข้อมูลในระบบสารสนเทศ', 210, height - 34, fonts.bold, 18)
  drawText(page, 'กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี', 315, height - 55, fonts.regular, 14)
  drawText(page, `หน่วยงาน ${round.name}`, 40, height - 84, fonts.regular, 14)
  drawText(page, `ไตรมาส ${round.quarter} / ${round.year + 543}`, 310, height - 84, fonts.regular, 14)
  drawText(page, `รหัสแบบฟอร์ม ${VERIFICATION_FORM_DISPLAY_CODE}`, width - 220, height - 84, fonts.regular, 12, MUTED)
  drawText(page, `Rev. ${revision ?? '-'} · มีผลบังคับใช้ ${effectiveDate ?? '-'}`, width - 260, height - 101, fonts.regular, 11, MUTED)

  const x = 40
  const tableTop = height - 126
  const rowHeight = 33
  const columns = [x, x + 55, x + 360, x + 480, x + 600, width - 40]
  const rows = Math.max(10, samples.length)
  for (let i = 0; i <= rows + 1; i++) {
    const y = tableTop - i * rowHeight
    page.drawLine({ start: { x, y }, end: { x: width - 40, y }, thickness: 0.7, color: LINE })
  }
  for (const column of columns) page.drawLine({ start: { x: column, y: tableTop }, end: { x: column, y: tableTop - (rows + 1) * rowHeight }, thickness: 0.7, color: LINE })
  page.drawRectangle({ x, y: tableTop - rowHeight, width: width - 80, height: rowHeight, color: LIGHT, opacity: 0.8 })
  drawText(page, 'ลำดับ', x + 12, tableTop - 22, fonts.bold, 12)
  drawText(page, 'LAB ID', columns[1] + 105, tableTop - 22, fonts.bold, 12)
  drawText(page, 'ผลการตรวจสอบ', columns[2] + 35, tableTop - 22, fonts.bold, 12)
  drawText(page, 'LIS → HIS', columns[3] + 25, tableTop - 22, fonts.bold, 12)
  drawText(page, 'Source → LIS', columns[4] + 20, tableTop - 22, fonts.bold, 12)
  samples.forEach((sample, index) => {
    const y = tableTop - (index + 2) * rowHeight + 11
    drawText(page, String(index + 1), x + 20, y, fonts.regular, 12)
    drawText(page, fitText(sample.ln, fonts.regular, 12, 280), columns[1] + 12, y, fonts.regular, 12)
    drawText(page, resultMark(sample.lis_to_his), columns[3] + 49, y, fonts.bold, 13)
    drawText(page, resultMark(sample.source_to_lis), columns[4] + 49, y, fonts.bold, 13)
    if (sample.remark) drawText(page, fitText(sample.remark, fonts.regular, 10, 110), columns[5] + 8, y + 2, fonts.regular, 10, MUTED)
  })
  const footerY = tableTop - (rows + 2) * rowHeight - 34
  drawText(page, 'หมายเหตุ: เก็บข้อมูลอย่างน้อย 1 ครั้ง ในรอบ 3 เดือน · P = ผ่าน · X = ไม่ผ่าน · N/A = ไม่เกี่ยวข้อง', x, footerY, fonts.regular, 11, MUTED)
  drawText(page, 'ผู้จัดทำ ............................................................', x, footerY - 35, fonts.regular, 13)
  drawText(page, 'ผู้ตรวจสอบ ........................................................', x + 390, footerY - 35, fonts.regular, 13)
  drawText(page, 'วันที่ ....................................', x, footerY - 58, fonts.regular, 13)
  drawText(page, 'วันที่ ....................................', x + 390, footerY - 58, fonts.regular, 13)
}

function drawOnOfficialTemplate(page: PDFPage, detail: VerificationRoundDetail, fonts: Fonts, revision: string | null, effectiveDate: string | null) {
  const { round, samples } = detail
  if (!round) return
  const width = page.getWidth()
  const height = page.getHeight()
  // The published form is the background. These overlays occupy its labelled
  // header/table fields while leaving the controlled layout and signatures intact.
  drawText(page, round.name, 70, height - 78, fonts.regular, 13)
  drawText(page, `ไตรมาส ${round.quarter}/${round.year + 543}`, 310, height - 78, fonts.regular, 13)
  drawText(page, `${VERIFICATION_FORM_DISPLAY_CODE} · Rev. ${revision ?? '-'}`, width - 230, height - 35, fonts.regular, 10, MUTED)
  drawText(page, effectiveDate ?? '-', width - 155, height - 49, fonts.regular, 10, MUTED)

  const startY = height - 185
  const rowHeight = 30
  samples.slice(0, 10).forEach((sample, index) => {
    const y = startY - index * rowHeight
    drawText(page, sample.ln, 215, y, fonts.regular, 12)
    drawText(page, resultMark(sample.lis_to_his), 610, y, fonts.bold, 13)
    drawText(page, resultMark(sample.source_to_lis), 728, y, fonts.bold, 13)
  })
}

function drawFindingsPage(pdf: PDFDocument, detail: VerificationRoundDetail, fonts: Fonts) {
  let page = pdf.addPage([OFFICIAL_PAGE.width, OFFICIAL_PAGE.height])
  const { round, samples } = detail
  if (!round) return
  const drawHeading = (target: PDFPage) => {
    drawText(target, 'ภาคผนวก — รายการประเด็นที่พบจากการทวนสอบ', 235, 620, fonts.bold, 18)
    drawText(target, `${round.name} · ไตรมาส ${round.quarter}/${round.year + 543} · ${VERIFICATION_FORM_DISPLAY_CODE}`, 260, 596, fonts.regular, 13, MUTED)
  }
  drawHeading(page)
  let y = 550
  for (const sample of samples) {
    for (const finding of sample.findings) {
      if (y < 120) {
        page = pdf.addPage([OFFICIAL_PAGE.width, OFFICIAL_PAGE.height])
        drawHeading(page)
        y = 550
      }
      page.drawRectangle({ x: 40, y: y - 46, width: 780, height: 58, borderColor: LINE, borderWidth: 0.7, color: LIGHT, opacity: 0.4 })
      drawText(page, `${sample.ln} · ${finding.transfer_point === 'lis_to_his' ? 'LIS → HIS' : 'Source → LIS'} · ${finding.status === 'closed' ? 'ปิดแล้ว' : 'เปิดอยู่'}`, 52, y - 10, fonts.bold, 12)
      drawText(page, fitText(finding.description, fonts.regular, 12, 740), 52, y - 30, fonts.regular, 12)
      y -= 76
    }
  }
}

export async function buildVerificationPdf(detail: VerificationRoundDetail): Promise<Uint8Array> {
  if (!detail.round) throw new Error('ไม่พบรอบการทวนสอบสำหรับสร้าง PDF')
  const template = await loadOfficialTemplate()
  const pdf = template.pdf
  const fonts = await getFonts(pdf)
  let page = pdf.getPages()[0]
  if (!page) page = pdf.addPage([OFFICIAL_PAGE.width, OFFICIAL_PAGE.height])
  if (page.getWidth() < 1 || page.getHeight() < 1) page = pdf.addPage([OFFICIAL_PAGE.width, OFFICIAL_PAGE.height])
  if (template.officialLoaded) {
    // Official document revisions may use a slightly different landscape size;
    // preserve that page rather than scaling or replacing the controlled form.
    drawOnOfficialTemplate(page, detail, fonts, template.revision, template.effectiveDate)
  } else {
    drawFallbackForm(page, detail, fonts, template.revision, template.effectiveDate)
  }

  const findingsCount = detail.samples.reduce((count, sample) => count + sample.findings.length, 0)
  if (findingsCount > 0) drawFindingsPage(pdf, detail, fonts)
  return pdf.save()
}
