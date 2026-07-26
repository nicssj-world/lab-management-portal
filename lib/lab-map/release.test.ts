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
// ถังดับเพลิงทั้ง 10 จุดยังไม่ยืนยันหน้างาน (แปลงพิกัดจากผังฉบับเก่าโดยประมาณ) — fail closed
// จนกว่าจะเดินสำรวจยืนยันตาม docs/lab-map/floor-3-acceptance.md แล้วตั้ง verified: true ทีละจุด
assert.deepEqual(
  validatePublishableRelease(valid),
  ['ยังไม่ได้ยืนยันตำแหน่งถังดับเพลิงหน้างาน'],
  'an otherwise-valid release is blocked only by unverified fire extinguisher positions',
)
assert.ok(validatePublishableRelease({ ...valid, effectiveDate: null }).length > 1)
assert.ok(validatePublishableRelease({ ...valid, approvedBy: valid.reviewedBy }).length > 1)
assert.ok(validatePublishableRelease({ ...valid, manifestHash: '0'.repeat(64) }).length > 0)
console.log('lab map release tests passed')
