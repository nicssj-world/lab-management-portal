import autoTable from 'jspdf-autotable'
import { createThaiPdfDoc } from '@/lib/external-quality/export'
import type { ChemicalPdfRow } from './export-rows'

export interface ChemicalRegistryPdfInput {
  rows: ChemicalPdfRow[]
  scopeLabel: string
  asOfDate: string
  generatedAt: string
  showGroupRows?: boolean
}

const HEADERS = [
  'No.',
  'ชื่อสาร',
  'Packing size',
  'สต๊อกขั้นต่ำ',
  'ปริมาตรรวม',
  'ประเภทสารเคมีตามระบบ GHS',
  'สถานะ',
  'ไฟล์ SDS',
]

const CENTERED_COLUMN_INDEXES = new Set([0, 2, 3, 4, 6, 7])

type PdfBodyRow =
  | { kind: 'group'; label: string }
  | { kind: 'chemical'; row: ChemicalPdfRow }

function buildPdfBodyRows(rows: ChemicalPdfRow[], showGroupRows: boolean): PdfBodyRow[] {
  const bodyRows: PdfBodyRow[] = []
  let currentGroup = ''
  for (const row of rows) {
    if (showGroupRows && row.groupLabel !== currentGroup) {
      bodyRows.push({ kind: 'group', label: row.groupLabel })
      currentGroup = row.groupLabel
    }
    bodyRows.push({ kind: 'chemical', row })
  }
  return bodyRows
}

function chemicalCells(row: ChemicalPdfRow): string[] {
  return [
    row.no,
    row.chemicalName,
    row.packingSize,
    row.minimumStock,
    row.totalVolume,
    row.ghsClassification,
    row.status,
    row.sdsFile,
  ]
}

export function buildChemicalRegistryPdf(input: ChemicalRegistryPdfInput): Buffer {
  const doc = createThaiPdfDoc('landscape')
  const totalPagesToken = '{total_pages_count_string}'
  const bodyRows = buildPdfBodyRows(input.rows, input.showGroupRows === true)

  doc.setFontSize(15)
  doc.text('Unit Chemical Inventory List', 148.5, 9, { align: 'center' })
  doc.setFontSize(8)
  doc.text(`Unit/Department: ${input.scopeLabel}`, 8, 16)
  doc.text(`ข้อมูล ณ วันที่: ${input.asOfDate}`, 8, 20)
  doc.text('ไฮไลท์สีเหลือง = สารเคมีนำเข้าใหม่', 289, 16, { align: 'right' })

  autoTable(doc, {
    startY: 24,
    head: [HEADERS],
    body: bodyRows.length
      ? bodyRows.map(item => item.kind === 'group'
        ? [{
          content: `หน่วยงาน: ${item.label}`,
          colSpan: HEADERS.length,
          styles: { fillColor: [225, 232, 242], textColor: [15, 65, 125], fontStyle: 'normal', halign: 'left' },
        }]
        : chemicalCells(item.row))
      : [['', 'ไม่มีข้อมูลตามตัวกรอง', '', '', '', '', '', '']],
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    margin: { top: 24, right: 8, bottom: 13, left: 8 },
    styles: {
      font: 'Sarabun', fontStyle: 'normal', fontSize: 7, cellPadding: 1.1,
      overflow: 'linebreak', lineColor: [30, 45, 65], lineWidth: 0.1,
    },
    headStyles: { font: 'Sarabun', fontStyle: 'normal', fillColor: [15, 65, 125], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 48 },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 25, halign: 'center' },
      5: { cellWidth: 61 },
      6: { cellWidth: 19, halign: 'center' },
      7: { cellWidth: 18, halign: 'center' },
    },
    didParseCell: data => {
      const bodyRow = bodyRows[data.row.index]
      const isChemicalBodyCell = data.section === 'body' && bodyRow?.kind === 'chemical'
      if ((data.section === 'head' || isChemicalBodyCell) && CENTERED_COLUMN_INDEXES.has(data.column.index)) {
        data.cell.styles.halign = 'center'
      }
      if (data.section === 'body' && bodyRow?.kind === 'chemical' && bodyRow.row.highlighted) {
        data.cell.styles.fillColor = [255, 243, 176]
      }
    },
    didDrawPage: data => {
      doc.setFontSize(7)
      doc.text(`สร้างเมื่อ ${input.generatedAt} · ${input.rows.length} รายการ`, 8, 205)
      doc.text(`หน้า ${data.pageNumber} / ${totalPagesToken}`, 289, 205, { align: 'right' })
    },
  })

  doc.putTotalPages(totalPagesToken)
  return Buffer.from(doc.output('arraybuffer'))
}
