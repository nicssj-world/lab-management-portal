import assert from 'node:assert/strict'
import { certificateSchema, laboratorySchema, serviceSchema } from './schemas'

assert.equal(laboratorySchema.safeParse({ sector: 'gov', name: 'Lab A', active: true, publishPublic: false, ownerIds: [] }).success, true)
assert.equal(laboratorySchema.safeParse({ sector: 'invalid', name: '' }).success, false)

assert.equal(serviceSchema.safeParse({ laboratoryId: crypto.randomUUID(), testId: 12, manualTestName: null, testNameSnapshot: 'TSH', isPrimary: true, active: true }).success, true)
assert.equal(serviceSchema.safeParse({ laboratoryId: crypto.randomUUID(), testId: null, manualTestName: 'Special assay', testNameSnapshot: 'Special assay', isPrimary: false, active: true }).success, false)
assert.equal(serviceSchema.safeParse({ laboratoryId: crypto.randomUUID(), testId: 12, manualTestName: 'TSH', testNameSnapshot: 'TSH', isPrimary: false, active: true }).success, false)

assert.equal(certificateSchema.safeParse({ laboratoryId: crypto.randomUUID(), standardName: 'ISO 15189', expiresOn: '2027-01-01', lifecycle: 'current' }).success, true)
assert.equal(certificateSchema.safeParse({ laboratoryId: crypto.randomUUID(), standardName: 'ISO 15189', validFrom: '2027-02-01', expiresOn: '2027-01-01', lifecycle: 'current' }).success, false)

console.log('lib/outlab/schemas.test.ts: all assertions passed')
