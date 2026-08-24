import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const client = readFileSync(
  'app/(protected)/staff/it/visitors/ItVisitorsClient.tsx',
  'utf8',
)

assert.match(client, /paginateVisitorLogs\(filtered, page\)/)
assert.match(client, /pagination\.items\.map\(/)
assert.match(client, /แสดง \{pagination\.from\}–\{pagination\.to\} จาก \{pagination\.total\} รายการ/)
assert.match(client, /setPage\(pagination\.page - 1\)/)
assert.match(client, /setPage\(pagination\.page \+ 1\)/)
assert.match(client, /buildVisitorRegisterHtml\(filtered, \{ from, to \}\)/)
assert.match(client, /<nav aria-label="การแบ่งหน้าบันทึกการเข้า-ออก"/)
assert.match(client, /aria-live="polite"/)
assert.match(client, /title="ไปหน้าก่อนหน้า"/)
assert.match(client, /title="ไปหน้าถัดไป"/)

console.log('visitor pagination UI tests passed')
