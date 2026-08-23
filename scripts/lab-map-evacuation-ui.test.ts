import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { isProtectedPath } from '../lib/auth/session-guard'

const root = process.cwd()
const pagePath = `${root}/app/(protected)/staff/lab-map/evacuation/page.tsx`
const clientPath = `${root}/components/lab-map/EvacuationClient.tsx`
const stylePath = `${root}/components/lab-map/EvacuationStyles.tsx`

assert.equal(existsSync(pagePath), true, 'ต้องมีหน้าเจ้าหน้าที่สำหรับแผนอพยพ')
assert.equal(existsSync(clientPath), true, 'ต้องมี client สำหรับการจัดการแผนอพยพ')
assert.equal(existsSync(stylePath), true, 'ต้องมี style ของโมดูลแผนอพยพ')

const page = readFileSync(pagePath, 'utf8')
const client = readFileSync(clientPath, 'utf8')
const styles = readFileSync(stylePath, 'utf8')

assert.match(page, /requireSafetyViewer/)
assert.match(page, /getEvacuationDashboard/)
assert.match(client, /\/api\/admin\/lab-map\/evacuation/)
assert.match(client, /\/api\/admin\/lab-map\/assembly-points/)
assert.match(client, /quality_task_attachments|attachments/)
assert.match(client, /drills\/\$\{selectedSession\.id\}/, 'การแก้ไขผลซ้อมต้อง PATCH รายการเดิม ไม่สร้าง session ซ้ำ')
assert.match(client, /role="tablist"/)
assert.match(client, /window\.print\(\)/)
assert.match(styles, /prefers-reduced-motion/)
assert.match(styles, /min-height:44px/)
assert.equal(isProtectedPath('/staff/lab-map/evacuation'), true, 'หน้าแผนอพยพต้องอยู่หลัง staff auth guard')

console.log('evacuation UI contract passed')
