import type { jsPDF } from 'jspdf'
import { MATRIX_COLS, MATRIX_ROWS, cellsFor, movementSummary, type MatrixRisk } from './matrix'

/**
 * PDF อ่าน CSS variable ไม่ได้ จึงต้องระบุ RGB ตรง ๆ
 * ค่าต้องสอดคล้องกับโทนใน MATRIX_BANDS (lib/risk/matrix.ts) — แก้ที่หนึ่งต้องแก้ที่นี่ด้วย
 */
const BAND_FILL: Record<string, [number, number, number]> = {
  'สูงมาก': [252, 226, 226],   // var(--danger) จาง
  'สูง': [253, 236, 210],      // var(--warning) จาง
  'ปานกลาง': [219, 243, 228],  // var(--success) จาง
  'ต่ำ': [238, 241, 245],      // var(--muted) จาง
}

const BAND_TEXT: Record<string, [number, number, number]> = {
  'สูงมาก': [185, 28, 28],
  'สูง': [180, 83, 9],
  'ปานกลาง': [21, 128, 61],
  'ต่ำ': [100, 116, 139],
}

const INK: [number, number, number] = [15, 23, 42]
const MUTED: [number, number, number] = [100, 116, 139]
const BORDER: [number, number, number] = [229, 234, 240]

type DrawOptions = {
  risks: MatrixRisk[]
  view: 'inherent' | 'residual'
  title: string
  subtitle: string
  startY?: number
}

/**
 * วาดตารางความเสี่ยง 5×5 ลงบนเอกสาร แล้วคืนตำแหน่ง y ที่วาดจบ
 *
 * ใช้ cellsFor ตัวเดียวกับหน้าจอ ตัวเลขในไฟล์จึงตรงกับที่ผู้ใช้เห็นเสมอ
 */
export function drawRiskMatrix(doc: jsPDF, { risks, view, title, subtitle, startY = 16 }: DrawOptions) {
  const cells = cellsFor(risks, view)
  const plotted = cells.reduce((total, cell) => total + cell.risks.length, 0)

  const cell = 22
  const axisGutter = 10
  const left = 20 + axisGutter
  const top = startY + 16

  doc.setTextColor(...INK)
  doc.setFontSize(15)
  doc.text(title, 14, startY)
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(subtitle, 14, startY + 6)

  // หัวคอลัมน์ = โอกาสเกิด
  doc.setFontSize(9)
  for (const likelihood of MATRIX_COLS) {
    doc.text(String(likelihood), left + (likelihood - 1) * cell + cell / 2, top - 3, { align: 'center' })
  }

  MATRIX_ROWS.forEach((impact, rowIndex) => {
    const y = top + rowIndex * cell
    doc.setTextColor(...MUTED)
    doc.text(String(impact), left - 4, y + cell / 2 + 1.5, { align: 'right' })

    for (const likelihood of MATRIX_COLS) {
      const current = cells.find(c => c.likelihood === likelihood && c.impact === impact)!
      const x = left + (likelihood - 1) * cell
      const count = current.risks.length

      doc.setFillColor(...(BAND_FILL[current.band.label] ?? BAND_FILL['ต่ำ']))
      doc.setDrawColor(...BORDER)
      doc.rect(x, y, cell, cell, 'FD')

      doc.setFontSize(7)
      doc.setTextColor(...MUTED)
      doc.text(String(current.score), x + cell / 2, y + cell / 2 - 1, { align: 'center' })

      doc.setFontSize(11)
      doc.setTextColor(...(count > 0 ? BAND_TEXT[current.band.label] ?? MUTED : MUTED))
      doc.text(count === 0 ? '—' : String(count), x + cell / 2, y + cell / 2 + 6, { align: 'center' })
    }
  })

  const gridBottom = top + MATRIX_ROWS.length * cell

  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('แนวนอน = โอกาสเกิด (Likelihood) 1–5', left, gridBottom + 6)
  doc.text('แนวตั้ง = ผลกระทบ (Impact) 1–5', left, gridBottom + 11)
  doc.text(`รวม ${plotted} รายการ · ไม่รวมรายการที่ปิดแล้ว`, left, gridBottom + 16)

  return gridBottom + 22
}

/** สรุปทิศทางการเปลี่ยนแปลงหลังทำมาตรการ เป็นข้อความใต้ตาราง */
export function drawMovementSummary(doc: jsPDF, risks: MatrixRisk[], y: number) {
  const summary = movementSummary(risks)
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  doc.text('ผลของมาตรการ', 14, y)
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(
    `ลดลง ${summary.improved} · เท่าเดิม ${summary.unchanged} · สูงขึ้น ${summary.worsened} · ยังไม่ประเมิน ${summary.unassessed}`,
    14, y + 5,
  )
  return y + 12
}
