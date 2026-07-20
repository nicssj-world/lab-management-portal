import assert from 'node:assert/strict'
import { formatTestReply, parseBatchItems } from './format'

const reply = formatTestReply({
  id: 31,
  code: '31',
  th: 'HIV-1 RNA Viral Load',
  en: 'HIV-1 RNA Viral Load (Quantitative)',
  price: 1800,
  tube: 'EDTA (ม่วง)',
  volume: '6 mL',
  tat: '7 วันทำการ',
  tat_minutes: null,
  tat_hours: null,
  available_24hr: false,
  service: 'พุธ, ศุกร์ ในเวลาราชการ',
  transport_condition: 'เก็บที่อุณหภูมิ 2–25°C ไม่ควรเกิน 24 ชั่วโมง',
  reject: 'ข้อมูลไม่ตรงกัน\nTube แตกหรือรั่ว\nปริมาณไม่เพียงพอ',
  specimen_note: 'ส่งหลังเวลา 8:30 น. จะตรวจรอบถัดไป',
  contact_staff: false,
  contact_name: 'งานอนูชีววิทยาคลินิก',
  contact_phone: '1467',
} as any, [], [])

assert.match(reply, /^🧪 HIV-1 RNA Viral Load\nHIV-1 RNA Viral Load \(Quantitative\)\n🔢 รหัส E-Phis: 31/m)
assert.match(reply, /📋 ข้อมูลหลัก\nราคา: 1,800 บาท\nสิ่งส่งตรวจ: EDTA \(ม่วง\) ปริมาตร 6 mL\nระยะเวลา: 7 วันทำการ/)
assert.match(reply, /⛔ เกณฑ์ปฏิเสธ: มี 3 ข้อ \(ดูรายละเอียดเต็ม\)\n\n📝 หมายเหตุ: ส่งหลังเวลา 8:30 น\. จะตรวจรอบถัดไป\n☎️ ติดต่อ: งานอนูชีววิทยาคลินิก 1467/)
assert.match(reply, /\n\n🔗 ดูรายละเอียดเต็ม: https:\/\/lab\.example\.test\/catalog\/31/)
assert.doesNotMatch(reply, /ข้อมูลไม่ตรงกัน/)

// ── parseBatchItems ───────────────────────────────────────────────────────────
// whitespace-separated numeric codes → batch of codes
assert.deepEqual(parseBatchItems('31 30074'), ['31', '30074'])
// comma-separated names → batch (each term looked up individually)
assert.deepEqual(parseBatchItems('CBC, BUN, FBS'), ['CBC', 'BUN', 'FBS'])
// newline-separated → batch, trimmed
assert.deepEqual(parseBatchItems('31\n30074\n97069'), ['31', '30074', '97069'])
// single search phrase with a space is NOT split (must stay a normal search)
assert.equal(parseBatchItems('vitamin d'), null)
// single token → not a batch
assert.equal(parseBatchItems('31'), null)
// mixed name + numeric across commas is allowed (comma is the explicit separator)
assert.deepEqual(parseBatchItems('CBC, 30074'), ['CBC', '30074'])
// de-duplicated case-insensitively, first-seen order preserved, no length cap
assert.deepEqual(parseBatchItems('cbc, CBC, bun'), ['cbc', 'bun'])
const fifteen = Array.from({ length: 15 }, (_, i) => `${30000 + i}`).join(', ')
assert.equal(parseBatchItems(fifteen)?.length, 15)

console.log('lib/line/format.test.ts: all assertions passed')
