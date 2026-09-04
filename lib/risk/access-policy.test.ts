import assert from 'node:assert/strict'
import { canCloseIncidentActor, canCloseRegisterActor, canManageIncidentActor, canReviewRiskActor } from './access-policy'

const riskTeamMember = { role: 'Medical Technologist', isRiskTeamMember: true }

assert.equal(canManageIncidentActor({ role: 'Assistant' }), true)
assert.equal(canManageIncidentActor({ role: 'Assistant', isActive: false }), true)
assert.equal(canManageIncidentActor(null), false)
assert.equal(canReviewRiskActor(riskTeamMember), true)
assert.equal(canCloseRegisterActor(riskTeamMember), true)
assert.equal(canCloseIncidentActor(riskTeamMember), false)

assert.equal(canReviewRiskActor({ role: 'Assistant' }), false)
assert.equal(canCloseRegisterActor({ role: 'Assistant' }), false)
assert.equal(canCloseIncidentActor({ role: 'Manager' }), true)
assert.equal(canCloseIncidentActor({ role: 'admin' }), true)
assert.equal(canReviewRiskActor({ role: 'Manager', isActive: false }), false)
assert.equal(canCloseRegisterActor({ role: 'Manager', isActive: false }), false)
assert.equal(canCloseIncidentActor({ role: 'Admin', isActive: false }), false)

console.log('risk access policy tests passed')
