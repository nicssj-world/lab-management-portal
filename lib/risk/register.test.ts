import assert from 'node:assert/strict'
import { nextReviewDate, reviewState } from './register'
import { riskLevel, riskScore } from '@/components/risk/shared/tokens'

// ── riskLevel: ต้องตรงกับ generated column ใน scripts/risk-module-v2.sql เป๊ะ ──
// ระบบเดิมบังคับ level='low' เมื่อไม่มี L×S ทำให้ dashboard นับ "Initial High" ได้เกือบศูนย์
assert.equal(riskLevel(riskScore(4, 4)), 'high')     // 16 ≥ 15
assert.equal(riskLevel(riskScore(3, 5)), 'high')     // 15 = ขอบล่างของ high
assert.equal(riskLevel(riskScore(2, 5)), 'medium')   // 10
assert.equal(riskLevel(riskScore(2, 4)), 'medium')   // 8 = ขอบล่างของ medium
assert.equal(riskLevel(riskScore(1, 5)), 'low')      // 5
assert.equal(riskLevel(riskScore(1, 1)), 'low')

// ไม่มีคะแนน = ยังไม่ประเมิน ต้องเป็น null ไม่ใช่ 'low'
assert.equal(riskScore(null, 4), null)
assert.equal(riskScore(4, null), null)
assert.equal(riskLevel(null), null)
assert.equal(riskLevel(riskScore(null, null)), null)

// ── nextReviewDate: เลื่อนไปอีก 1 ปีตามรอบทบทวน ISO 15189 8.5 ──
assert.equal(nextReviewDate('2026-07-22'), '2027-07-22')
assert.equal(nextReviewDate('2026-01-31'), '2027-01-31')
// 29 ก.พ. ปีอธิกสุรทิน → ปีถัดไปไม่มีวันนั้น ต้องไม่พังและต้องได้วันที่จริง
assert.equal(nextReviewDate('2028-02-29'), '2029-03-01')

// ── reviewState: ยังไม่ตั้งรอบ / เลยกำหนด / ใกล้ครบ / ยังไม่ถึง ──
assert.equal(reviewState(null), 'unset')
assert.equal(reviewState(''), 'unset')

const today = new Date()
const shift = (days: number) => {
  const d = new Date(today)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA')
}

assert.equal(reviewState(shift(-1)), 'overdue')    // เมื่อวาน
assert.equal(reviewState(shift(30)), 'due')        // อยู่ในหน้าต่างเตือน 90 วัน
assert.equal(reviewState(shift(89)), 'due')        // ขอบในของหน้าต่าง
assert.equal(reviewState(shift(200)), 'ok')        // ยังอีกไกล

console.log('register tests passed')
