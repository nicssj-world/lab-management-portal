import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccessHeadContact, canDeleteHeadContact } from './access'
import { validateHeadContactSubmission } from './validation'
import type { HeadContactSubmissionInput } from './types'

const base: HeadContactSubmissionInput = {
  sender_name: '',
  contact_channel: '',
  service_unit_id: '11111111-1111-4111-8111-111111111111',
  service_unit_name: 'งานเคมีคลินิก',
  other_service_unit: '',
  category: 'suggestion',
  detail: 'ข้อเสนอแนะสำหรับปรับปรุงการให้บริการให้ดียิ่งขึ้น',
  wants_reply: false,
}

test('only Admin and the group lead can access head-contact cases', () => {
  assert.equal(canAccessHeadContact({ role: 'Admin', dept_role: null }), true)
  assert.equal(canAccessHeadContact({ role: 'Medical Technologist', dept_role: 'group_lead' }), true)
  assert.equal(canAccessHeadContact({ role: 'Manager', dept_role: null }), false)
  assert.equal(canAccessHeadContact({ role: 'Medical Technologist', dept_role: 'group_deputy' }), false)
})

test('only Admin can permanently delete a head-contact case', () => {
  assert.equal(canDeleteHeadContact({ role: 'Admin' }), true)
  assert.equal(canDeleteHeadContact({ role: 'Medical Technologist' }), false)
})

test('accepts an anonymous submission without a reply request', () => {
  const result = validateHeadContactSubmission(base)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.row.sender_name, null)
    assert.equal(result.row.contact_channel, null)
    assert.equal(result.row.service_unit_snapshot, 'งานเคมีคลินิก')
  }
})

test('requires a contact channel when a reply is requested', () => {
  const result = validateHeadContactSubmission({ ...base, wants_reply: true })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.issues.some((issue) => issue.field === 'contact_channel'))
})

test('requires and snapshots a named unit when other is selected', () => {
  const missing = validateHeadContactSubmission({
    ...base,
    service_unit_id: 'other',
    service_unit_name: '',
  })
  assert.equal(missing.ok, false)
  if (!missing.ok) assert.ok(missing.issues.some((issue) => issue.field === 'other_service_unit'))

  const valid = validateHeadContactSubmission({
    ...base,
    service_unit_id: 'other',
    service_unit_name: '',
    other_service_unit: 'คลินิกเฉพาะทาง',
  })
  assert.equal(valid.ok, true)
  if (valid.ok) {
    assert.equal(valid.row.service_unit_id, null)
    assert.equal(valid.row.service_unit_snapshot, 'คลินิกเฉพาะทาง')
  }
})

test('rejects details shorter than ten characters or longer than five thousand', () => {
  assert.equal(validateHeadContactSubmission({ ...base, detail: 'สั้น' }).ok, false)
  assert.equal(validateHeadContactSubmission({ ...base, detail: 'ก'.repeat(5_001) }).ok, false)
})
