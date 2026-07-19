import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import { buildCatalogServiceImport, selectNHealthCodes, type NHealthCodeRow } from '../lib/outlab/catalog-import'
import { isOutlabCatalogTest } from '../lib/outlab/domain'

dotenv.config({ path: '.env.local' })

const SOURCE_PATH = process.argv.find(argument => !argument.startsWith('--') && argument !== process.argv[0] && argument !== process.argv[1])
const SHOULD_APPLY = process.argv.includes('--apply')
const N_HEALTH_LAB_NAME = 'N Health'
const BATCH_SIZE = 100

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function asText(value: unknown) {
  return String(value ?? '').trim()
}

function importRowsFromWorkbook(sourcePath: string): NHealthCodeRow[] {
  const workbook = XLSX.readFile(sourcePath)
  const rows: NHealthCodeRow[] = []

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null, raw: true })
    const header = data[0] as unknown[] | undefined
    if (!header || !asText(header[0]).includes('รหัส') || !asText(header[2]).includes('รหัส N-health')) {
      throw new Error(`รูปแบบชีต ${sheetName} ไม่ตรงกับไฟล์สถิติ: ต้องมีรหัส E-Phis ที่คอลัมน์ A และรหัส N-health ที่คอลัมน์ C`)
    }
    for (let index = 1; index < data.length; index++) {
      const row = data[index] as unknown[]
      const ephisCode = asText(row[0])
      if (!ephisCode) continue
      rows.push({ ephisCode, nHealthCode: asText(row[2]), sheetName, rowNumber: index + 1 })
    }
  }

  return rows
}

async function main() {
  if (!SOURCE_PATH) throw new Error('ระบุพาธไฟล์ .xlsx ที่ต้องการนำเข้า')

  const db = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )
  const sourceRows = importRowsFromWorkbook(SOURCE_PATH)
  const nHealthCodes = selectNHealthCodes(sourceRows)
  const [labResult, testsResult, servicesResult] = await Promise.all([
    db.from('outlab_laboratories').select('id, name').eq('name', N_HEALTH_LAB_NAME).eq('active', true).single(),
    db.from('tests').select('id, code, th, category_id, department, method, tube, volume, transport_condition, tat, tat_hours, tat_minutes, price').eq('active', true),
    db.from('outlab_services').select('id, laboratory_id, test_id').eq('active', true),
  ])
  for (const result of [labResult, testsResult, servicesResult]) if (result.error) throw result.error
  if (!labResult.data) throw new Error(`ไม่พบห้องปฏิบัติการ ${N_HEALTH_LAB_NAME} ที่ใช้งานอยู่`)
  const laboratory = labResult.data

  const catalogTests = (testsResult.data ?? []).filter(isOutlabCatalogTest)
  const existingByTestId = new Map<number, { id: string }>()
  for (const service of servicesResult.data ?? []) {
    if (service.laboratory_id !== laboratory.id || service.test_id === null) continue
    if (existingByTestId.has(service.test_id)) throw new Error(`พบบริการ N Health ซ้ำสำหรับ Catalog test ID ${service.test_id}`)
    existingByTestId.set(service.test_id, service)
  }

  const importedServices = buildCatalogServiceImport(catalogTests, nHealthCodes)
  const inserts = importedServices
    .filter(service => !existingByTestId.has(service.test_id))
    .map(service => ({ ...service, laboratory_id: laboratory.id }))
  const updates = importedServices
    .filter(service => existingByTestId.has(service.test_id))
    .map(service => ({ id: existingByTestId.get(service.test_id)!.id, ...service }))
  const withoutExternalCode = importedServices.filter(service => service.external_code === null).length

  console.log(JSON.stringify({
    mode: SHOULD_APPLY ? 'apply' : 'dry-run',
    laboratory: laboratory.name,
    sourceRows: sourceRows.length,
    catalogServices: importedServices.length,
    withNHealthCode: importedServices.length - withoutExternalCode,
    withoutExternalCode,
    insert: inserts.length,
    update: updates.length,
  }, null, 2))

  if (!SHOULD_APPLY) return

  for (let index = 0; index < inserts.length; index += BATCH_SIZE) {
    const { error } = await db.from('outlab_services').insert(inserts.slice(index, index + BATCH_SIZE))
    if (error) throw error
  }
  for (const update of updates) {
    const { id, ...payload } = update
    const { error } = await db.from('outlab_services').update(payload).eq('id', id)
    if (error) throw error
  }

  const { error: auditError } = await db.from('audit_log').insert({
    action: 'outlab.service.bulk_import',
    target: laboratory.id,
    detail: `นำเข้าบริการส่งต่อจาก Catalog ${importedServices.length} รายการ; มีรหัส N-Health ${importedServices.length - withoutExternalCode} รายการ; ไฟล์ ${SOURCE_PATH}`,
  })
  if (auditError) throw auditError
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
