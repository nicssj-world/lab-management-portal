import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const checkInSql = read('scripts/quality-task-check-in.sql')
const checkInLogic = read('lib/quality-tasks/check-in.ts')
const adminRoute = read('app/api/admin/quality-tasks/occurrences/[id]/check-in-token/route.ts')
const dashboard = read('components/quality-tasks/QualityTaskDashboard.tsx')
const client = read('components/quality-tasks/QualityTaskCheckInClient.tsx')

assert.match(checkInSql, /check_in_closed_at/, 'schema must store a manual check-in close timestamp')
assert.match(checkInLogic, /closeCheckIn/, 'server logic must expose a close operation')
assert.match(checkInLogic, /check_in_closed_at/, 'check-in reads must enforce the close timestamp')
assert.match(checkInLogic, /title:\s*occurrenceDisplayTitle\(/, 'QR check-in context must use the occurrence subject/title, not only the template')
assert.match(dashboard, /\{adHocIsMeeting \? "ชื่อประชุม" : "ชื่อรอบ\/เหตุการณ์"\}/, 'ad-hoc meeting form must label the occurrence subject as the meeting name')
assert.ok(dashboard.includes('ชื่อนี้จะแสดงบนหน้า QR เช็คอิน'), 'ad-hoc meeting form must explain where the meeting name is shown')
assert.match(adminRoute, /export async function PATCH/, 'admin route must expose a close endpoint')
assert.match(dashboard, /ปิดรับ Check-in/, 'QR modal must offer a close check-in button')
assert.match(client, /ปิดรับเช็คอินแล้ว/, 'check-in page must explain the manual close state')

console.log('scripts/quality-task-check-in.test.ts: all assertions passed')
