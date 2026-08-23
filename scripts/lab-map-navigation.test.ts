import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { isProtectedPath } from '../lib/auth/session-guard'

const page = readFileSync('app/(protected)/staff/lab-map/page.tsx', 'utf8')
const client = readFileSync('components/lab-map/LabMapStaffClient.tsx', 'utf8')
const sidebar = readFileSync('components/layout/StaffSidebar.tsx', 'utf8')
const topbar = readFileSync('components/layout/StaffTopbar.tsx', 'utf8')

assert.ok(isProtectedPath('/staff/lab-map'))

// QR ของป้ายเปิดแผนที่ความปลอดภัยสาธารณะได้ แต่ projection ต้องสร้างจากข้อมูลกลาง
// ไม่ใช้ public manifest ชุดที่สองซึ่งเสี่ยงพิกัดไม่ตรงกับป้ายจริง
assert.ok(existsSync('app/(public)/lab-map/[stationCode]/page.tsx'), 'the QR safety map route exists')
assert.ok(existsSync('lib/lab-map/public-safety.ts'), 'the QR route uses a constrained safety projection')
assert.ok(!existsSync('lib/lab-map/public-manifest.ts'), 'no second hand-maintained public manifest')

assert.match(page, /await createClient\(\)/)
assert.match(page, /auth\.getUser\(\)/)
assert.match(page, /redirect\('\/login'\)/)
assert.match(page, /getStaffLabMapDTO/)
assert.match(page, /<LabMapStaffClient/)

assert.match(client, /^'use client'/)
assert.match(client, /LabMapShell/)
assert.doesNotMatch(client, /supabase/)
assert.doesNotMatch(client, /lab-map\/manifest/)

// ── กลุ่ม "ความปลอดภัย" ในแถบเมนูเจ้าหน้าที่ ──
const safetyGroup = sidebar.match(/\{ href: '\/staff\/safety',[\s\S]*?\] \},/)?.[0] ?? ''
assert.ok(safetyGroup, 'the lab map entry is a sidebar group')
assert.match(safetyGroup, /th: 'ความปลอดภัย'/, 'the parent is named ความปลอดภัย')
assert.match(safetyGroup, /children: \[/, 'the parent has children')
assert.match(safetyGroup, /th: 'แผนที่ห้องปฏิบัติการ', en: 'Laboratory Map'/)
// แม่ต้องไม่ถือ resource — รูปแบบเดียวกับกลุ่มความเสี่ยงและกลุ่ม IT
assert.doesNotMatch(safetyGroup.split('\n')[0], /resource:/, 'the safety group parent must not carry a resource gate')

// แยกเป็นคนละโมดูลในเมนู เพื่อไม่ให้ทะเบียนอุปกรณ์กับแผนอพยพถูกรวมเป็นงานเดียว
assert.match(safetyGroup, /href: '\/staff\/lab-map\/safety-assets', th: 'อุปกรณ์ความปลอดภัย'/, 'safety equipment has its own sidebar entry')
assert.match(safetyGroup, /href: '\/staff\/lab-map\/evacuation', th: 'จุดรวมพล \/ แผนอพยพ'/, 'evacuation has its own sidebar entry')
assert.doesNotMatch(safetyGroup, /อุปกรณ์และจุดรวมพล/, 'the old combined safety navigation label is removed')

assert.match(topbar, /'\/staff\/lab-map'/)
for (const route of ['/staff/lab-map/safety-assets', '/staff/lab-map/evacuation', '/staff/lab-map/print', '/staff/lab-map/sds']) {
  assert.ok(topbar.includes(`'${route}'`), `topbar names ${route} instead of falling back to the module root`)
}

console.log('lab map staff navigation passed')
