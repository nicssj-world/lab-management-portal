import assert from 'node:assert/strict'
import { canEditExternalQualityModule } from './access'

assert.equal(canEditExternalQualityModule('Admin', false), true)
assert.equal(canEditExternalQualityModule('admin', false), true)
assert.equal(canEditExternalQualityModule('Manager', true), true)
assert.equal(canEditExternalQualityModule('Medical Technologist', false), false)

console.log('lib/external-quality/access.test.ts: all assertions passed')
