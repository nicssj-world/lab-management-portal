import assert from 'node:assert/strict'
import {
  certificateUrgency,
  catalogServiceDefaults,
  findOutlabCatalogTestByEphisCode,
  isOutlabCatalogTest,
  OUTLAB_SECTOR_LABEL,
  type OutlabCertificateLifecycle,
} from './domain'

const TODAY = '2026-07-19'

assert.equal(certificateUrgency('2026-10-18', 'current', TODAY), 'valid')
assert.equal(certificateUrgency('2026-10-17', 'current', TODAY), 'watch')
assert.equal(certificateUrgency('2026-09-17', 'current', TODAY), 'urgent')
assert.equal(certificateUrgency('2026-08-18', 'current', TODAY), 'critical')
assert.equal(certificateUrgency('2026-07-19', 'current', TODAY), 'critical')
assert.equal(certificateUrgency('2026-07-18', 'current', TODAY), 'expired')

for (const lifecycle of ['superseded', 'revoked'] satisfies OutlabCertificateLifecycle[]) {
  assert.equal(certificateUrgency('2020-01-01', lifecycle, TODAY), 'inactive')
}

assert.deepEqual(OUTLAB_SECTOR_LABEL, { gov: 'ภาครัฐ', priv: 'เอกชน', other: 'อื่นๆ' })

const specialCatalogTest = {
  department: 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ',
  method: 'PCR', transport_condition: 'แช่เย็น 2–8°C', tat: null, tat_hours: 48, tat_minutes: null, price: 1250,
}
assert.equal(isOutlabCatalogTest(specialCatalogTest), true)
assert.equal(isOutlabCatalogTest({ ...specialCatalogTest, department: null, category_id: 'outl' }), true)
assert.equal(isOutlabCatalogTest({ ...specialCatalogTest, department: 'งานตรวจพิเศษและปฏิบัติการตรวจต่อ' }), true)
assert.equal(isOutlabCatalogTest({ ...specialCatalogTest, department: 'งานเคมีคลินิก' }), false)
assert.deepEqual(catalogServiceDefaults(specialCatalogTest), { method: 'PCR', transportCondition: 'แช่เย็น 2–8°C', tatText: '48 ชั่วโมง', price: 1250 })
assert.equal(findOutlabCatalogTestByEphisCode([{ id: 7, code: 'E-123' }], ' e-123 ')?.id, 7)
assert.equal(findOutlabCatalogTestByEphisCode([{ id: 7, code: 'E-123' }], 'E-999'), undefined)

console.log('lib/outlab/domain.test.ts: all assertions passed')
