import assert from 'node:assert/strict'
import { deriveSafetyAssetStatus } from '../lib/lab-map/safety-domain'
import { assemblyPointInputSchema, safetyAssetInputSchema } from '../lib/validations/lab-map-safety'

const base = { positionStatus: 'verified' as const, latestResult: 'passed' as const }

assert.equal(deriveSafetyAssetStatus({ ...base }, '2026-07-26'), 'passed')
assert.equal(deriveSafetyAssetStatus({ ...base, positionStatus: 'unverified' }, '2026-07-26'), 'unverified')
assert.equal(deriveSafetyAssetStatus({ ...base, latestResult: 'failed' }, '2026-07-26'), 'failed')
assert.equal(deriveSafetyAssetStatus({ ...base, latestResult: 'not_found' }, '2026-07-26'), 'failed')
assert.equal(deriveSafetyAssetStatus({ ...base, nextInspectionDate: '2026-07-25' }, '2026-07-26'), 'overdue')
assert.equal(deriveSafetyAssetStatus({ ...base, expiresOn: '2026-08-10' }, '2026-07-26'), 'due_soon')
assert.equal(deriveSafetyAssetStatus({ ...base, latestResult: 'needs_attention' }, '2026-07-26'), 'needs_attention')

const asset = {
  code: 'AED-01', nameTh: 'AED หน้า Central Lab', kind: 'aed', x: 400, y: 300,
  spaceCode: 'central-lab-left', shutoffFor: null,
}
assert.equal(safetyAssetInputSchema.safeParse(asset).success, true)
assert.equal(safetyAssetInputSchema.safeParse({ ...asset, x: 1478 }).success, false)
assert.equal(safetyAssetInputSchema.safeParse({ ...asset, kind: 'emergency-shutoff', shutoffFor: null }).success, false)
assert.equal(safetyAssetInputSchema.safeParse({ ...asset, kind: 'emergency-shutoff', shutoffFor: 'gas' }).success, true)

const assembly = {
  code: 'ASSEMBLY-01', nameTh: 'หน้าอาคารอำนวยการ', detailTh: 'ด้านหน้าหอพระ',
  latitude: null, longitude: null, exitCodes: ['exit-3a'],
}
assert.equal(assemblyPointInputSchema.safeParse(assembly).success, true, 'draft assembly point may omit GPS')
assert.equal(assemblyPointInputSchema.safeParse({ ...assembly, latitude: 91, longitude: 101 }).success, false)
assert.equal(assemblyPointInputSchema.safeParse({ ...assembly, latitude: 13.3, longitude: 181 }).success, false)
assert.equal(assemblyPointInputSchema.safeParse({ ...assembly, exitCodes: [] }).success, true, 'draft may be saved before exits are confirmed')
assert.equal(assemblyPointInputSchema.safeParse({ ...assembly, exitCodes: ['door-office'] }).success, false, 'only exits 3A, 3B, and 3C are allowed')

console.log('lab map safety domain tests passed')
