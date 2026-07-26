import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync('app/(protected)/staff/lab-map/print/page.tsx', 'utf8')

assert.match(page, /canManageMapReleases/, 'gates the panel with the same Admin/Manager check the API already enforces')
assert.match(page, /LabMapReleasePanel/, 'renders the new panel')
assert.match(page, /canManage \? <LabMapReleasePanel/, 'the panel is only rendered for Admin/Manager, not shipped to every role')
assert.match(page, /select\('id, name, role'\)/, 'fetches the staff list for the reviewer/approver pickers')
assert.match(page, /reviewerName/, 'resolves the reviewer profile name before it is used')
assert.match(page, /approverName/, 'resolves the approver profile name before it is used')
// เดิม query เรียง status ก่อน (published มาก่อน draft ตามตัวอักษรเสมอ ไม่ใช่ตามความใหม่) ทำให้เห็นฉบับร่างใหม่ไม่ได้
// อีกต่อไปถ้าเคยมีฉบับเผยแพร่มาก่อน — ต้องแยกดึงฉบับล่าสุดของแต่ละสถานะเอง การเลือกจริงอยู่ใน
// pickReleaseRows (lib/lab-map/release.ts) ซึ่งมีเทสต์ของตัวเองใน lib/lab-map/release-pick.test.ts
assert.doesNotMatch(page, /order\('status'/, 'no longer sorts by status text — published vs draft is resolved explicitly in code')
assert.match(page, /pickReleaseRows\(/, 'delegates published/draft selection to the tested pure helper')

console.log('lab map release wiring contract passed')
