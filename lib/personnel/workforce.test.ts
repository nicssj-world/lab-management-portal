import assert from 'node:assert/strict'
import { firstFilledWorkforceLabel, sortWorkforceRowsDescending } from './workforce'

assert.equal(firstFilledWorkforceLabel('ไม่ระบุประเภทการจ้าง', null), 'ไม่ระบุประเภทการจ้าง')
assert.equal(firstFilledWorkforceLabel('ไม่ระบุประเภทการจ้าง', ''), 'ไม่ระบุประเภทการจ้าง')
assert.equal(firstFilledWorkforceLabel('ไม่ระบุประเภทการจ้าง', '   '), 'ไม่ระบุประเภทการจ้าง')
assert.equal(firstFilledWorkforceLabel('ไม่ระบุประเภทการจ้าง', ' ข้าราชการ '), 'ข้าราชการ')
assert.equal(firstFilledWorkforceLabel('ไม่ระบุหน่วยงาน', '', ' Hematology '), 'Hematology')

assert.deepEqual(
  sortWorkforceRowsDescending([
    { label: 'Assistant', value: 19, color: '#7C3AED' },
    { label: 'Medical Technologist', value: 32, color: '#1E5FAD' },
    { label: 'Other', value: 2, color: '#64748B' },
  ]).map((row) => row.label),
  ['Medical Technologist', 'Assistant', 'Other'],
)
