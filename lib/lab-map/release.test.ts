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
// อุปกรณ์และจุดรวมพล static fallback ยังไม่ยืนยันหน้างาน — legacy release ต้อง fail closed
assert.deepEqual(
  validatePublishableRelease(valid),
  [
    'ยังไม่ได้ยืนยันตำแหน่งอุปกรณ์ความปลอดภัยหน้างาน',
    'จุดรวมพลยังยืนยันไม่ครบ ต้องมี GPS รูปหลักฐาน และทางออกอย่างน้อยหนึ่งจุด',
  ],
  'an otherwise-valid legacy release is blocked by unverified safety locations',
)
assert.ok(validatePublishableRelease({ ...valid, effectiveDate: null }).length > 1)
assert.ok(validatePublishableRelease({ ...valid, approvedBy: valid.reviewedBy }).length > 1)
assert.ok(validatePublishableRelease({ ...valid, manifestHash: '0'.repeat(64) }).length > 0)
console.log('lab map release tests passed')
