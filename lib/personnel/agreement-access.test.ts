import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canApproveAgreementCampaign,
  canManageAgreementCampaigns,
  canViewAgreementCampaigns,
} from './agreement-access'

test('only the group lead can approve an annual agreement campaign', () => {
  assert.equal(canApproveAgreementCampaign('group_lead'), true)
  assert.equal(canApproveAgreementCampaign('group_deputy'), false)
  assert.equal(canApproveAgreementCampaign(null), false)
})

test('Admin and Manager can manage campaigns without gaining approval authority', () => {
  assert.equal(canManageAgreementCampaigns('Admin'), true)
  assert.equal(canManageAgreementCampaigns('Manager'), true)
  assert.equal(canApproveAgreementCampaign(null), false)
})

test('a group lead can view campaigns without an Admin or Manager system role', () => {
  assert.equal(canViewAgreementCampaigns('Medical Technologist', 'group_lead'), true)
  assert.equal(canViewAgreementCampaigns('Assistant', null), false)
})
