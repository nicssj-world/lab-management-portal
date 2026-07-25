import assert from 'node:assert/strict'
import { computeManifestHash, currentManifestHash, validatePublishableRelease } from './release'

assert.equal(computeManifestHash({ b: 2, a: 1 }), computeManifestHash({ a: 1, b: 2 }))
assert.notEqual(computeManifestHash({ route: ['a'] }), computeManifestHash({ route: ['b'] }))
assert.match(currentManifestHash(), /^[a-f0-9]{64}$/)

const valid = {
  status: 'draft' as const,
  versionCode: 'F3-2026.07.26-01',
  manifestHash: currentManifestHash(),
  effectiveDate: '2026-07-26',
  reviewedBy: '11111111-1111-4111-8111-111111111111',
  approvedBy: '22222222-2222-4222-8222-222222222222',
  approvedAt: '2026-07-26T02:00:00.000Z',
}
assert.deepEqual(validatePublishableRelease(valid), [])
assert.ok(validatePublishableRelease({ ...valid, effectiveDate: null }).length > 0)
assert.ok(validatePublishableRelease({ ...valid, approvedBy: valid.reviewedBy }).length > 0)
assert.ok(validatePublishableRelease({ ...valid, manifestHash: '0'.repeat(64) }).length > 0)
console.log('lab map release tests passed')
