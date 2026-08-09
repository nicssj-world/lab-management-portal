import assert from 'node:assert/strict'
import {
  dueDateForMonth,
  fiscalMonths,
  pointStatusForMonth,
  validateNssSubmission,
  validateSpillKitSubmission,
} from './monthly-safety'

assert.equal(dueDateForMonth('2026-08', 15), '2026-08-15')
assert.deepEqual(fiscalMonths(2570), [
  '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03',
  '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09',
])

assert.equal(pointStatusForMonth({ submittedAt: null, issueCount: 0, skippedAt: null, dueOn: '2026-08-15' }, '2026-08-07'), 'pending')
assert.equal(pointStatusForMonth({ submittedAt: null, issueCount: 0, skippedAt: null, dueOn: '2026-08-15' }, '2026-08-08'), 'due_soon')
assert.equal(pointStatusForMonth({ submittedAt: null, issueCount: 0, skippedAt: null, dueOn: '2026-08-15' }, '2026-08-16'), 'overdue')
assert.equal(pointStatusForMonth({ submittedAt: '2026-08-10T02:00:00Z', issueCount: 2, skippedAt: null, dueOn: '2026-08-15' }, '2026-08-16'), 'submitted_with_issues')
assert.equal(pointStatusForMonth({ submittedAt: null, issueCount: 0, skippedAt: '2026-08-09T00:00:00Z', dueOn: '2026-08-15' }, '2026-08-16'), 'skipped')

assert.deepEqual(validateSpillKitSubmission({
  inspectedOn: '2026-08-10',
  answers: [
    { supplyId: 'supply-1', itemKey: 'gloves', result: 'normal', expiresOn: '2026-09-30', note: null },
    { supplyId: 'supply-2', itemKey: 'mask', result: 'missing', expiresOn: null, note: 'เติมของแล้ว' },
  ],
}), { ok: true, issueCount: 1 })

assert.deepEqual(validateSpillKitSubmission({
  inspectedOn: '2026-08-10',
  answers: [{ supplyId: 'supply-1', itemKey: 'gloves', result: 'normal', expiresOn: '2026-08-09', note: null }],
}), { ok: false, error: 'รายการที่หมดอายุแล้วห้ามบันทึกเป็นปกติ' })

assert.deepEqual(validateNssSubmission({
  activeBottleIds: ['nss-1', 'nss-2'],
  bottles: [
    { supplyId: 'nss-1', clarity: 'clear', bottleCondition: 'intact', correctiveAction: null },
    { supplyId: 'nss-2', clarity: 'turbid', bottleCondition: 'intact', correctiveAction: 'เปลี่ยนขวดแล้ว' },
  ],
}), { ok: true, issueCount: 1 })

assert.deepEqual(validateNssSubmission({
  activeBottleIds: ['nss-1', 'nss-2'],
  bottles: [{ supplyId: 'nss-1', clarity: 'clear', bottleCondition: 'intact', correctiveAction: null }],
}), { ok: false, error: 'กรุณาตรวจขวด NSS ที่ใช้งานอยู่ให้ครบทุกขวด' })

console.log('monthly safety domain tests passed')
