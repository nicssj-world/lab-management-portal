import assert from 'node:assert/strict'
import { canEditExternalQualityModule, externalQualityLevel } from './access'

assert.equal(canEditExternalQualityModule('Admin', false), true)
assert.equal(canEditExternalQualityModule('admin', false), true)
assert.equal(canEditExternalQualityModule('Manager', true), true)
assert.equal(canEditExternalQualityModule('Medical Technologist', false), false)

// Permission matrix level drives access when the user is not admin/listed editor.
assert.equal(canEditExternalQualityModule('Medical Technologist', false, 'edit'), true)
assert.equal(canEditExternalQualityModule('Medical Technologist', false, 'view'), false)
assert.equal(externalQualityLevel('Medical Technologist', false, 'none'), 'none')
assert.equal(externalQualityLevel('Medical Technologist', false, 'view'), 'view')
assert.equal(externalQualityLevel('Medical Technologist', true, 'none'), 'edit')
assert.equal(externalQualityLevel('Admin', false, 'none'), 'edit')

console.log('lib/external-quality/access.test.ts: all assertions passed')
