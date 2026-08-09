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

console.log('monthly safety UI/API contract passed')
