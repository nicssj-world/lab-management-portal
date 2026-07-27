// สร้างคลังเอกสาร SDS แยกตามงานจากไฟล์ที่ importer อัปโหลดขึ้น R2 ไปแล้ว
//
// scripts/import-chemical-safety.ts อัปโหลด PDF ทุกไฟล์ในคลัง MSDS 2568 ขึ้น R2 และบันทึกลง
// chemical_sds_files พร้อม source_paths ที่ขึ้นต้นด้วยชื่อโฟลเดอร์งาน แต่มีเพียง 25 สารของ
// ห้องเก็บสารเคมีเท่านั้นที่ถูกทำให้เป็น product ไฟล์ของงานอื่นจึงลอยอยู่โดยไม่มีอะไรอ้างถึง
//
// สคริปต์นี้อ่านจากฐานข้อมูลล้วน ไม่อ่านดิสก์ และไม่แตะ R2 เพราะไฟล์อยู่ครบแล้ว
//
//   npx tsx scripts/backfill-department-sds.ts            # dry-run
//   npx tsx scripts/backfill-department-sds.ts --apply

import { config } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  CHEMICAL_SDS_DEPARTMENTS,
  archiveFolderOf,
  cleanSdsDisplayName,
  departmentForArchiveFolder,
} from '../lib/chemical-safety/departments'

config({ path: '.env.local', override: false })
config({ path: '.env', override: false })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

const apply = process.argv.includes('--apply')
const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

interface PlannedRow {
  departmentCode: string
  fileId: string
  sourcePath: string
  displayName: string
}

function assertResult(result: { error: unknown }, operation: string): void {
  if (!result.error) return
  const message = typeof result.error === 'object' && result.error && 'message' in result.error
    ? String(result.error.message)
    : String(result.error)
  throw new Error(`${operation} failed: ${message}`)
}

async function loadSdsFiles(client: SupabaseClient) {
  const result = await client
    .from('chemical_sds_files')
    .select('id, file_name, source_paths, content_type')
  assertResult(result, 'load chemical_sds_files')
  return (result.data ?? []) as Array<{
    id: string
    file_name: string
    source_paths: unknown
    content_type: string
  }>
}

function buildPlan(files: Awaited<ReturnType<typeof loadSdsFiles>>) {
  const rows: PlannedRow[] = []
  const skippedFolders = new Map<string, number>()
  const seen = new Set<string>()
  let nonPdf = 0

  for (const file of files) {
    // หน้าสาธารณะสตรีมเฉพาะ PDF เท่านั้น ไฟล์ doc/docx จึงไม่ควรขึ้นรายการให้กดแล้วเปิดไม่ได้
    if (file.content_type !== 'application/pdf') {
      nonPdf += 1
      continue
    }

    const paths = Array.isArray(file.source_paths)
      ? file.source_paths.filter((value): value is string => typeof value === 'string')
      : []

    // ไฟล์เดียวกัน (sha256 ตรงกัน) อาจถูกวางไว้หลายงาน จึงผูกให้ทุกงานที่มีไฟล์นั้น
    for (const sourcePath of paths) {
      const folder = archiveFolderOf(sourcePath)
      const department = departmentForArchiveFolder(folder)
      if (!department) {
        skippedFolders.set(folder, (skippedFolders.get(folder) ?? 0) + 1)
        continue
      }

      const key = `${department.code}::${file.id}`
      if (seen.has(key)) continue
      seen.add(key)

      rows.push({
        departmentCode: department.code,
        fileId: file.id,
        sourcePath,
        displayName: cleanSdsDisplayName(sourcePath),
      })
    }
  }

  return { rows, skippedFolders, nonPdf }
}

async function main() {
  const files = await loadSdsFiles(supabase)
  const { rows, skippedFolders, nonPdf } = buildPlan(files)

  const byDepartment = new Map<string, number>()
  for (const row of rows) byDepartment.set(row.departmentCode, (byDepartment.get(row.departmentCode) ?? 0) + 1)

  console.log(`mode: ${apply ? 'apply' : 'dry-run'}`)
  console.log(`chemical_sds_files: ${files.length} (skipped ${nonPdf} non-PDF)`)
  console.log(`planned department links: ${rows.length}`)
  for (const department of CHEMICAL_SDS_DEPARTMENTS) {
    console.log(`  ${department.code.padEnd(14)} ${String(byDepartment.get(department.code) ?? 0).padStart(4)}  ${department.department}`)
  }
  if (skippedFolders.size > 0) {
    console.log('skipped folders (expected: ห้องสารเคมี only):')
    for (const [folder, count] of [...skippedFolders].sort()) {
      console.log(`  ${folder || '(no folder)'} — ${count}`)
    }
  }

  // งานที่ไม่ได้ไฟล์เลยมักแปลว่าชื่อโฟลเดอร์เปลี่ยน ไม่ใช่ว่างานนั้นไม่มี SDS จริง
  const empty = CHEMICAL_SDS_DEPARTMENTS.filter(item => (byDepartment.get(item.code) ?? 0) === 0)
  if (empty.length > 0) {
    console.warn(`WARNING: ${empty.length} department(s) matched no file: ${empty.map(item => item.code).join(', ')}`)
  }

  if (!apply) {
    console.log('dry-run complete — re-run with --apply to write')
    return
  }

  const existing = await supabase
    .from('chemical_department_sds')
    .select('department_code, file_id, display_name_edited')
  assertResult(existing, 'load existing chemical_department_sds')
  const editedKeys = new Set(
    (existing.data ?? [])
      .filter(row => row.display_name_edited === true)
      .map(row => `${row.department_code}::${row.file_id}`),
  )

  const payload = rows.map(row => ({
    department_code: row.departmentCode,
    file_id: row.fileId,
    source_path: row.sourcePath,
    display_name: row.displayName,
    updated_at: new Date().toISOString(),
  }))

  // ชื่อที่มีคนแก้ด้วยมือแล้วต้องไม่ถูกเขียนทับ — ข้ามไปเลย
  // (แถวพวกนี้มีอยู่ในตารางแล้วแน่นอน เพราะ editedKeys มาจากตารางเดียวกัน)
  const preserved = payload.filter(row => editedKeys.has(`${row.department_code}::${row.file_id}`))
  const writable = payload.filter(row => !editedKeys.has(`${row.department_code}::${row.file_id}`))

  for (let index = 0; index < writable.length; index += 200) {
    const chunk = writable.slice(index, index + 200)
    const result = await supabase
      .from('chemical_department_sds')
      .upsert(chunk, { onConflict: 'department_code,file_id' })
    assertResult(result, `upsert department sds chunk ${index}`)
  }

  console.log(`applied: ${writable.length} written, ${preserved.length} kept manual names`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
