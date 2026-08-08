import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import type { ChemicalExportRow } from './export-rows'

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

const CENTERED_COLUMNS = ['A', 'C', 'D', 'E', 'G', 'H'] as const

interface ExportStyles {
  xml: string
  highlightStyleId: number
  centeredStyleId: number
  centeredHighlightStyleId: number
}

function patchStyles(stylesXml: string): ExportStyles | null {
  const fills = stylesXml.match(/<fills count="(\d+)">/)
  const cellXfs = stylesXml.match(/<cellXfs count="(\d+)">/)
  if (!fills || !cellXfs) return null

  const fillId = Number(fills[1])
  const styleId = Number(cellXfs[1])
  const highlightFill = '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF3B0"/><bgColor indexed="64"/></patternFill></fill>'
  const highlightXf = `<xf numFmtId="0" fontId="0" fillId="${fillId}" borderId="0" xfId="0" applyFill="1"/>`
  const centeredXf = '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>'
  const centeredHighlightXf = `<xf numFmtId="0" fontId="0" fillId="${fillId}" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>`

  return {
    xml: stylesXml
      .replace(fills[0], `<fills count="${fillId + 1}">`)
      .replace('</fills>', `${highlightFill}</fills>`)
      .replace(cellXfs[0], `<cellXfs count="${styleId + 3}">`)
      .replace('</cellXfs>', `${highlightXf}${centeredXf}${centeredHighlightXf}</cellXfs>`),
    highlightStyleId: styleId,
    centeredStyleId: styleId + 1,
    centeredHighlightStyleId: styleId + 2,
  }
}

function styleRowCells(xml: string, styles: ExportStyles, highlighted: boolean): string {
  return xml.replace(/<c\b([^>]*)>/g, (full, attributes: string) => {
    const column = attributes.match(/\br="([A-Z]+)\d+"/)?.[1]
    const centered = column ? CENTERED_COLUMNS.includes(column as typeof CENTERED_COLUMNS[number]) : false
    if (!centered && !highlighted) return full

    const styleId = highlighted
      ? centered ? styles.centeredHighlightStyleId : styles.highlightStyleId
      : styles.centeredStyleId
    if (/\bs="\d+"/.test(attributes)) return full.replace(/\bs="\d+"/, `s="${styleId}"`)
    return `<c s="${styleId}"${attributes}>`
  })
}

async function applyHighlights(buffer: Buffer, highlightedRows: number[], totalRows: number): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer)
  const stylesEntry = zip.file('xl/styles.xml')
  const sheetEntry = zip.file('xl/worksheets/sheet1.xml')
  if (!stylesEntry || !sheetEntry) return buffer

  const styles = patchStyles(await stylesEntry.async('string'))
  if (!styles) return buffer
  let sheetXml = await sheetEntry.async('string')
  const highlighted = new Set(highlightedRows)
  for (let rowNumber = 1; rowNumber <= totalRows + 1; rowNumber += 1) {
    const rowPattern = new RegExp(`(<row\\b[^>]*\\br="${rowNumber}"[^>]*>)([\\s\\S]*?)(</row>)`)
    sheetXml = sheetXml.replace(rowPattern, (_full, opening: string, body: string, closing: string) => (
      `${opening}${styleRowCells(body, styles, highlighted.has(rowNumber))}${closing}`
    ))
  }

  zip.file('xl/styles.xml', styles.xml)
  zip.file('xl/worksheets/sheet1.xml', sheetXml)
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }))
}

export async function buildChemicalRegistryExcel(rows: ChemicalExportRow[]): Promise<Buffer> {
  const worksheet = XLSX.utils.aoa_to_sheet([
    HEADERS,
    ...rows.map(row => [
      row.no,
      row.chemicalName,
      row.packingSize,
      row.minimumStock,
      row.totalVolume,
      row.ghsClassification,
      row.status,
      row.sdsFile,
    ]),
  ])
  worksheet['!cols'] = [
    { wch: 8 }, { wch: 36 }, { wch: 18 }, { wch: 20 },
    { wch: 18 }, { wch: 38 }, { wch: 14 }, { wch: 14 },
  ]
  worksheet['!autofilter'] = { ref: `A1:H${Math.max(1, rows.length + 1)}` }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ทะเบียนสารเคมี')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return applyHighlights(buffer, rows.flatMap((row, index) => row.highlighted ? [index + 2] : []), rows.length)
}
