import assert from 'node:assert/strict'
import test from 'node:test'
import { canApproveItReview } from './guard'

test('Admin and the group lead can approve an IT access review', () => {
  assert.equal(canApproveItReview({ role: 'Admin', dept_role: null }), true)
  assert.equal(canApproveItReview({ role: 'Medical Technologist', dept_role: 'group_lead' }), true)
})

test('document roles and the group deputy do not gain IT review approval authority', () => {
  assert.equal(canApproveItReview({ role: 'Medical Technologist', dept_role: null }), false)
  assert.equal(canApproveItReview({ role: 'Medical Technologist', dept_role: 'group_deputy' }), false)
})
