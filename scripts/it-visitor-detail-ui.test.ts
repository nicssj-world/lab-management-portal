import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const filePath = path.join(process.cwd(), 'app', '(protected)', 'staff', 'it', 'visitors', 'ItVisitorsClient.tsx')
const source = fs.readFileSync(filePath, 'utf8')

assert.match(source, /maxWidth=\{760\}/, 'detail modal should have a wider reading width')
assert.match(source, /ข้อมูลผู้มาติดต่อ/, 'detail modal should group contact information')
assert.match(source, /รายละเอียดการเข้าพื้นที่/, 'detail modal should group visit information')
assert.match(source, /สถานะการเข้า-ออก/, 'detail modal should expose a clear visit status section')
assert.match(source, /function DetailField\(/, 'detail modal should use a reusable field layout')
assert.match(source, /ไม่ระบุ/, 'detail modal should handle missing optional values explicitly')
assert.match(source, /aria-label="ปิดหน้าต่าง"/, 'modal close action should be announced to assistive technology')
assert.match(source, /detail\.badge_exchanged === 'yes'/, 'badge status should distinguish yes from no')

console.log('IT visitor detail UI checks passed')
