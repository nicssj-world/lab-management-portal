import assert from 'node:assert/strict'

import { buildReadLogSummaryHtml } from '../lib/documents/read-log-summary'

const html = buildReadLogSummaryHtml(
  { title: 'การเตรียมน้ำยา Standard 1 และ 2', document_code: 'CF-WI-E-BM06-01', type: 'WI' },
  [
    { userId: 'u2', name: 'วิรุฬห์ เหลืองทองหลาง', position: 'นักเทคนิคการแพทย์', lastRead: '2026-06-25T16:40:00.000Z' },
    { userId: 'u1', name: 'ศิริวิมน์ จำปรีรัตน์', role: 'Admin', lastRead: '2026-07-10T16:18:00.000Z' },
    { userId: 'u1', name: 'ศิริวิมน์ จำปรีรัตน์', role: 'Admin', lastRead: '2026-07-11T16:18:00.000Z' },
  ],
)

assert.match(html, /แบบบันทึกการลงชื่อรับทราบ/)
assert.match(html, /ประเภทเอกสาร วิธีปฏิบัติ \(WI\)/)
assert.match(html, /เรื่อง การเตรียมน้ำยา Standard 1 และ 2&nbsp;&nbsp;&nbsp;รหัส CF-WI-E-BM06-01/)
assert.match(html, /Fm-QP-LAB-01\/05/)
assert.equal(html.match(/ศิริวิมน์ จำปรีรัตน์/g)?.length, 1, 'deduplicates readers by user id')
assert.match(html, /นักเทคนิคการแพทย์/, 'falls back to role-based position labels')
assert.ok(
  html.indexOf('วิรุฬห์ เหลืองทองหลาง') < html.indexOf('ศิริวิมน์ จำปรีรัตน์'),
  'sorts readers by ascending latest read time',
)
assert.match(html, /11 ก\.ค\. 2569/, 'keeps the latest read time for duplicate readers')

console.log('read-log-summary tests passed')
