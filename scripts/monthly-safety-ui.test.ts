import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const boardPath = 'components/safety-tasks/MonthlySafetyInspectionBoard.tsx'
assert.ok(existsSync(join(process.cwd(), boardPath)), 'monthly inspection board exists')
const board = read(boardPath)
const hub = read('components/safety-tasks/SafetyTaskHub.tsx')

for (const label of ['ตรวจประจำเดือน', 'งานของฉัน', 'ทุกจุด', 'ยังไม่ส่ง', 'ส่งแล้ว', 'เกินกำหนด', 'พบปัญหา']) {
  assert.ok(`${hub}\n${board}`.includes(label), `monthly safety UI renders ${label}`)
}
for (const label of ['ปกติทั้งหมด', 'ขาด', 'ชำรุด', 'หมดอายุ', 'ไม่เกี่ยวข้อง', 'ความใส', 'สภาพขวด']) {
  assert.ok(board.includes(label), `monthly safety form renders ${label}`)
}
assert.ok(board.includes('min-height:44px') || board.includes('min-height: 44px'), 'form controls have mobile touch targets')
assert.ok(board.includes('@media(max-width:767px)') || board.includes('@media (max-width: 767px)'), 'board has a mobile layout')

for (const route of [
  'app/api/admin/safety-tasks/monthly-inspections/route.ts',
  'app/api/admin/safety-tasks/monthly-inspections/[roundItemId]/route.ts',
  'app/api/admin/safety-tasks/monthly-inspections/[roundItemId]/submit/route.ts',
  'app/api/admin/safety-tasks/monthly-inspections/report/route.ts',
]) assert.ok(existsSync(join(process.cwd(), route)), `${route} exists`)

// A task-opened inspection round (fire extinguisher, eyewash, …) writes round items
// into the same table with a due_on, so the monthly board must filter by the profile
// stamped in template_snapshot. Without it a ถังดับเพลิง shows up tagged SPILL and the
// form crashes on its empty snapshot.
const monthlyServer = read('lib/quality-tasks/monthly-safety-server.ts')
const monthlyDomain = read('lib/quality-tasks/monthly-safety.ts')
assert.match(monthlyDomain, /MONTHLY_SAFETY_PROFILES/, 'domain exports the monthly profile list')
assert.equal(
  monthlyServer.match(/\.in\('template_snapshot->>profile', MONTHLY_SAFETY_PROFILES\)/g)?.length,
  2,
  'both the board query and the fiscal-year report query are scoped to monthly points',
)
assert.match(monthlyServer, /isMonthlySafetyProfile\(\(row\.template_snapshot as Row\)\?\.profile\)/, 'loading a single point rejects non-monthly round items')
assert.doesNotMatch(monthlyServer, /snapshot\?\.profile \?\? asset\?\.inspection_profile/, 'point profile never falls back to the asset profile')
assert.doesNotMatch(board, /profile === 'nss_eyewash' \? 'NSS' : 'SPILL'/, 'the type badge is not a two-way guess')
assert.match(board, /PROFILE_LABELS\[profile\]\?\.label \?\?/, 'an unknown profile is labelled as unknown, not as a spill kit')

console.log('monthly safety UI/API contract passed')
