import assert from 'node:assert/strict'
import {
  classifyRejectionReason,
  normalizeRejectionReason,
  resolveExistingRejectRollup,
} from './analysis'

const cases: Array<[string | null, string]> = [
  [null, 'no_detail'],
  ['', 'no_detail'],
  ['Repeat Na 190', 'repeat_duplicate'],
  ['แพทย์ยกเลิกตรวจ', 'cancelled'],
  ['Request ผิดรายการ', 'request_order'],
  ['ไม่พบ Specimen', 'specimen_missing'],
  ['Specimen ผิดชนิด', 'specimen_type'],
  ['Specimen Contaminate K 20', 'contamination'],
  ['เจาะเลือดไม่ถึงปริมาตรที่กำหนด', 'specimen_quality'],
  ['คนไข้มีGROUPแล้ว', 'blood_bank'],
  ['ยังไม่ผ่านการเงิน', 'finance_eligibility'],
  ['K=16', 'result_quality'],
  ['ระบบ ephis มีปัญหา', 'system_data'],
  ['ส่งเกินจำนวนครั้งนอกเกณฑ์กำหนด', 'criteria_external'],
]

for (const [reason, expected] of cases) {
  assert.equal(classifyRejectionReason(reason).categoryCode, expected, reason ?? '(empty)')
}

assert.equal(normalizeRejectionReason('  Repeat.   Na 190  '), 'repeat na 190')
assert.equal(classifyRejectionReason('ข้อความที่ไม่อยู่ในกฎ').needsReview, true)

const mainRejects = new Set([
  'Specimen Clot',
  'specimen Hemolysis',
  'ตัวอย่างไม่พอ',
  'ไม่ได้รับสิ่งส่งตรวจ',
  'Request ผิดคน',
])
assert.equal(resolveExistingRejectRollup('clot โทรไปให้เจาะใหม่', mainRejects), 'Specimen Clot')
assert.equal(resolveExistingRejectRollup('ไม่มีสิ่งส่งตรวจส่งมา', mainRejects), 'ไม่ได้รับสิ่งส่งตรวจ')
assert.equal(resolveExistingRejectRollup('Request ผิดคน', mainRejects), 'Request ผิดคน')
assert.equal(resolveExistingRejectRollup('ไม่พบ Hemolysis', mainRejects), null)

console.log(`rejection analysis tests passed (${cases.length + 6} assertions)`)
