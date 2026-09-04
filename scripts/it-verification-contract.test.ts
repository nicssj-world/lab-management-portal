import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import test from 'node:test'

const root = process.cwd()
const read = (path: string) => readFileSync(`${root}/${path}`, 'utf8').replace(/\r\n/g, '\n')

test('verification migration creates the complete protected schema and seeds the official mappings', () => {
  const files = readdirSync(`${root}/supabase/migrations`)
  const file = files.find((name) => name.includes('it_verification'))
  assert.ok(file, 'expected an it_verification migration')
  const sql = read(`supabase/migrations/${file}`)
  for (const table of [
    'it_verification_rounds',
    'it_verification_sampling_runs',
    'it_verification_samples',
    'it_verification_findings',
    'it_verification_assignees',
    'it_verification_section_map',
  ]) assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'))
  for (const department of ['CHE', 'IMM', 'HEM', 'MIS', 'MIC', 'MOL', 'BLB']) assert.match(sql, new RegExp(`'${department}'`))
  assert.match(sql, /enable row level security/i)
  assert.match(sql, /revoke all on table/i)
  assert.match(sql, /source_month[\s\S]*legacy_manual/i)
  assert.match(sql, /md5\(v_seed::text \|\| '\\|' \|\| p\.ln\)/i)
  assert.match(sql, /unique \(round_id, department_id\)/i)
  assert.match(sql, /status in \('completed', 'skipped_existing', 'no_population', 'failed', 'void'\)/i)
  assert.match(sql, /generate_it_verification_samples_from_tat/i)
  assert.match(sql, /upload_id uuid references public\.tat_uploads\(id\) on delete set null/i)
  assert.match(sql, /resample_it_verification_samples_from_tat/i)
  assert.match(sql, /ไม่พบข้อมูล raw TAT ของไฟล์นี้/i)
  assert.match(sql, /grant execute on function public\.generate_it_verification_samples_from_tat[\s\S]*?to service_role/i)
  assert.match(sql, /grant execute on function public\.resample_it_verification_samples_from_tat[\s\S]*?to service_role/i)
  assert.match(sql, /grant execute on function public\.update_it_verification_sample[\s\S]*?to service_role/i)
  assert.match(sql, /sample_state = 'void'/i)
  assert.match(sql, /before delete on public\.it_verification_(sampling_runs|samples|findings|rounds)/i)
  assert.match(sql, /revoke delete, truncate[\s\S]*?from service_role/i)
  assert.match(sql, /fail' and not exists[\s\S]*?status <> 'closed'/i)
  assert.doesNotMatch(sql, /(?:patient_name|patientname|hn)\s+(?:text|varchar|char|citext)/i)
})

test('verification navigation and permission resource are wired to the existing shell', () => {
  const resources = read('lib/permission-resources.ts')
  const sidebar = read('components/layout/StaffSidebar.tsx')
  const topbar = read('components/layout/StaffTopbar.tsx')
  assert.match(resources, /ทวนสอบการส่งผ่านข้อมูล HIS & LIS/)
  assert.match(sidebar, /\/staff\/it\/verification/)
  assert.match(sidebar, /ทวนสอบการส่งผ่านข้อมูล HIS & LIS/)
  assert.match(topbar, /\/staff\/it\/verification/)
  assert.match(sidebar, /parentHref|children/) // preserve the existing IT parent/child shell
})

test('verification route tree and loading state exist', () => {
  assert.equal(existsSync(`${root}/app/(protected)/staff/it/verification/page.tsx`), true)
  assert.equal(existsSync(`${root}/app/(protected)/staff/it/verification/[roundId]/page.tsx`), true)
  assert.equal(existsSync(`${root}/app/(protected)/staff/it/verification/loading.tsx`), true)
  assert.equal(existsSync(`${root}/app/api/admin/it/verification/summary/route.ts`), true)
  assert.equal(existsSync(`${root}/app/api/admin/it/verification/sampling/generate/route.ts`), true)
  assert.equal(existsSync(`${root}/app/api/admin/it/verification/sampling/resample/route.ts`), true)
  assert.equal(existsSync(`${root}/app/api/admin/it/verification/rounds/[id]/review/route.ts`), true)
  assert.equal(existsSync(`${root}/app/api/admin/it/verification/rounds/[id]/reopen/route.ts`), true)
  assert.equal(existsSync(`${root}/app/api/admin/it/verification/rounds/[id]/pdf/route.ts`), true)
  assert.equal(existsSync(`${root}/app/api/admin/it/verification/samples/[id]/route.ts`), true)
  assert.equal(existsSync(`${root}/app/api/staff/it/verification/summary/route.ts`), true)
  assert.equal(existsSync(`${root}/app/api/staff/it/verification/rounds/[id]/route.ts`), true)
  assert.equal(existsSync(`${root}/app/api/staff/it/verification/sampling/resample/route.ts`), true)
})

test('TAT integration is synchronous and preserves successful upload semantics on sampler warning', () => {
  const route = read('app/api/admin/tat/upload/chunk/route.ts')
  assert.match(route, /generate_it_verification_samples_from_tat/)
  assert.match(route, /sampling.*warning|samplingWarning/i)
  assert.match(route, /is_last_chunk/)
  assert.match(route, /await supabaseAdmin\.rpc/)
  assert.match(route, /IT_DEPARTMENTS/)
  assert.match(route, /p_department_id: department\.id/)
})

test('cleanup guard is scoped to tat-clean-raw and has an explicit September 2026 go-live', () => {
  const script = read('scripts/tat-clean-raw.mjs')
  assert.match(script, /VERIFICATION_SAMPLING_GO_LIVE/)
  assert.match(script, /2026-09-01/)
  assert.match(script, /--force/)
  assert.match(script, /it_verification/i)
})

test('UI uses the established clinical control-room language and accessible feedback states', () => {
  const page = read('app/(protected)/staff/it/verification/VerificationOverviewClient.tsx')
  const detail = read('app/(protected)/staff/it/verification/[roundId]/VerificationDetailClient.tsx')
  for (const source of [page, detail]) {
    assert.match(source, /var\(--primary\)/)
    assert.match(source, /aria-live/)
    assert.match(source, /minHeight:\s*44|height:\s*44/)
    assert.match(source, /loading|กำลัง/)
    assert.match(source, /error|ผิดพลาด|ไม่สำเร็จ/)
  }
  assert.match(page, /ตัวอย่างทั้งหมด/)
  assert.match(page, /สถานะหน่วยงาน/)
  assert.match(page, /it-verification-desktop-table \{ display:block; \}/)
  assert.match(page, /warningGroups/)
  assert.match(detail, /LIS.*HIS|HIS.*LIS/)
})
