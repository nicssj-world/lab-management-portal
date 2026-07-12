import assert from 'node:assert/strict'
import { DOC_TYPES, TYPE_LABEL } from './type-labels'

// Display order: QM > QP > WI > Rf > Fm > Cf > Lb > Mn > Policy > Others, everywhere types
// are listed (filters, categories) — see lib/validations/document.ts DOC_TYPES.
const expected = ['QM', 'QP', 'WI', 'Reference', 'Form', 'Card file', 'Lb', 'Manual', 'Policy', 'Others']
assert.deepEqual([...DOC_TYPES], expected)
assert.ok(!DOC_TYPES.includes('Record' as never), 'Record must be removed')

for (const type of DOC_TYPES) {
  assert.ok(TYPE_LABEL[type], `TYPE_LABEL is missing an entry for "${type}"`)
}

assert.equal(TYPE_LABEL.QP, 'ระเบียบปฏิบัติ (QP)')
assert.equal(TYPE_LABEL.WI, 'วิธีปฏิบัติงาน (WI)')
assert.equal(TYPE_LABEL.Form, 'แบบฟอร์ม (Fm)')
assert.equal(TYPE_LABEL.Policy, 'นโยบาย (CBH)')
assert.equal(TYPE_LABEL.Manual, 'คู่มือ (MN)')
assert.equal(TYPE_LABEL.QM, 'คู่มือคุณภาพ (QM)')
assert.equal(TYPE_LABEL.Reference, 'เอกสารอ้างอิง (Rf)')
assert.equal(TYPE_LABEL['Card file'], 'เอกสารประกอบการปฏิบัติงาน (Cf)')
assert.equal(TYPE_LABEL.Lb, 'สมุดบันทึก (Lb)')
assert.equal(TYPE_LABEL.Others, 'เอกสารอื่นๆ')

console.log('type-labels tests passed')
