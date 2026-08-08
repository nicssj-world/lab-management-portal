import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import { chemicalRegistryExportRequestSchema } from '@/lib/chemical-safety/schemas'
import { buildChemicalRegistryExcel } from '@/lib/chemical-safety/registry-excel'

const request = chemicalRegistryExportRequestSchema.safeParse({
  format: 'xlsx',
  filters: {
    q: 'acetone',
    unitId: '11111111-1111-4111-8111-111111111111',
    roomId: '22222222-2222-4222-8222-222222222222',
    lifecycle: 'active',
  },
  newChemicalHoldingIds: ['33333333-3333-4333-8333-333333333333'],
})
assert.equal(request.success, true, 'export request must accept the current registry filters')
assert.equal(
  chemicalRegistryExportRequestSchema.safeParse({ format: 'csv', filters: {}, newChemicalHoldingIds: [] }).success,
  false,
  'export request must only accept PDF or Excel formats',
)

const route = readFileSync(join(process.cwd(), 'app', 'api', 'admin', 'chemical-safety', 'registry', 'export', 'route.ts'), 'utf8')
assert.ok(route.includes('export async function POST'), 'registry export API must support a format-selecting POST')
assert.ok(route.includes('newChemicalHoldingIds'), 'registry export API must receive highlighted holding IDs')
assert.ok(route.includes('parsed.data.filters'), 'registry export API must pass all selected registry filters to the repository')
assert.ok(route.includes('buildChemicalRegistryExcel'), 'registry export API must build Excel files')
assert.ok(route.includes('showPdfGroupRows'), 'registry export API must enable grouped PDF rows for all departments')
assert.ok(route.includes('formatChemicalRegistryScopeLabel'), 'registry export PDF title must use the selected unit/department name and row count')
const schemas = readFileSync(join(process.cwd(), 'lib', 'chemical-safety', 'schemas.ts'), 'utf8')
assert.ok(schemas.includes('roomId: uuid.optional()'), 'export filters must include the chemical-room filter')

const pdf = readFileSync(join(process.cwd(), 'lib', 'chemical-safety', 'registry-pdf.ts'), 'utf8')
for (const header of ['No.', 'ชื่อสาร', 'Packing size', 'สต๊อกขั้นต่ำ', 'ปริมาตรรวม', 'ประเภทสารเคมีตามระบบ GHS', 'สถานะ', 'ไฟล์ SDS']) {
  assert.ok(pdf.includes(header), `PDF export must contain the ${header} column`)
}
assert.ok(pdf.includes('หน่วยงาน: ${item.label}'), 'PDF export must render a department separator row')
assert.ok(pdf.includes('showGroupRows'), 'PDF export must support grouped department rows')
assert.ok(!pdf.includes("fontStyle: 'bold'"), 'PDF group rows must use the registered Sarabun regular font for Thai text')
assert.ok(pdf.includes("halign: 'center'"), 'PDF export must center the requested numeric/status columns')
assert.ok(pdf.includes("data.section === 'head'"), 'PDF export must explicitly center the requested header cells')

const excel = readFileSync(join(process.cwd(), 'lib', 'chemical-safety', 'registry-excel.ts'), 'utf8')
for (const header of ['No.', 'ชื่อสาร', 'Packing size', 'สต๊อกขั้นต่ำ', 'ปริมาตรรวม', 'ประเภทสารเคมีตามระบบ GHS', 'สถานะ', 'ไฟล์ SDS']) {
  assert.ok(excel.includes(header), `Excel export must contain the ${header} column`)
}
assert.ok(excel.includes('FFFFF3B0'), 'Excel export must define a highlight fill for imported-new chemicals')
assert.ok(excel.includes('!cols'), 'Excel export must define readable column widths')
assert.ok(excel.includes('CENTERED_COLUMNS'), 'Excel export must center the requested numeric/status columns')

void (async () => {
  const workbook = await buildChemicalRegistryExcel([{
    no: '1', chemicalName: 'Acetone', packingSize: '500 mL', minimumStock: '2', totalVolume: '1 L',
    ghsClassification: 'สารกัดกร่อน', status: 'Active', sdsFile: 'Yes', highlighted: true,
  }])
  const zip = await JSZip.loadAsync(workbook)
  const stylesXml = await zip.file('xl/styles.xml')?.async('string')
  const sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('string')
  assert.ok(stylesXml?.includes('FFFFF3B0'), 'generated Excel workbook must include the highlight fill')
  assert.ok(stylesXml?.includes('horizontal="center"'), 'generated Excel workbook must include centered cell styles')
  assert.match(sheetXml ?? '', /s="2"[^>]*r="A1"/, 'Excel header No. must be centered')
  assert.match(sheetXml ?? '', /s="3"[^>]*r="A2"/, 'highlighted Excel No. row must remain centered')
  assert.match(sheetXml ?? '', /<row[^>]*r="2"[\s\S]*<c s="1"/, 'highlighted Excel row must reference the highlight style')
  console.log('chemical-safety export contract: ok')
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})
