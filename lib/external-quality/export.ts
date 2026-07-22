import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { sarabunBase64 } from '@/lib/fonts/sarabun-base64'

export type ExportSheet = { name: string; rows: Array<Record<string, unknown>> }

export function buildExcel(sheets: ExportSheet[]) {
  const workbook = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows.length ? sheet.rows : [{ รายการ: 'ไม่มีข้อมูล' }])
    worksheet['!cols'] = Object.keys(sheet.rows[0] ?? { รายการ: '' }).map(key => ({ wch: Math.min(48, Math.max(14, key.length + 4)) }))
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31))
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

/**
 * เอกสาร PDF ที่ฝังฟอนต์ Sarabun ไว้แล้ว — ไม่งั้นภาษาไทยจะกลายเป็นกล่อง
 * แยกออกมาให้ผู้เรียกที่ต้องวาดเองก่อนค่อยต่อด้วยตาราง (เช่น ตารางความเสี่ยง) ใช้ได้
 */
export function createThaiPdfDoc(orientation: 'portrait' | 'landscape' = 'portrait') {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  doc.addFileToVFS('Sarabun-Regular.ttf', sarabunBase64)
  doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal')
  doc.setFont('Sarabun')
  return doc
}

export function buildThaiPdf(title: string, subtitle: string, headers: string[], rows: string[][]) {
  const doc = createThaiPdfDoc(headers.length > 5 ? 'landscape' : 'portrait')
  doc.setFontSize(16)
  doc.text(title, 14, 16)
  doc.setFontSize(10)
  doc.text(subtitle, 14, 23)
  autoTable(doc, {
    startY: 28,
    head: [headers],
    body: rows.length ? rows : [['ไม่มีข้อมูล']],
    styles: { font: 'Sarabun', fontStyle: 'normal', fontSize: 8, cellPadding: 1.7, overflow: 'linebreak' },
    headStyles: { font: 'Sarabun', fontStyle: 'normal', fillColor: [15, 118, 110] },
  })
  return Buffer.from(doc.output('arraybuffer'))
}

export function exportResponse(buffer: Buffer, fileName: string, contentType: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
