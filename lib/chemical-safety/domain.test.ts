import assert from 'node:assert/strict'
import {
  calculateHoldingTotal,
  currentSdsState,
  detectQuantityConflict,
  normalizeCasNumber,
  normalizeChemicalName,
} from './domain'
import { CHEMICAL_PREP_LOCATIONS, INITIAL_POSITION_ASSIGNMENTS, LOCATION_GROUP_COLORS } from './storage-manifest'

assert.equal(CHEMICAL_PREP_LOCATIONS.length, 13)
assert.deepEqual(CHEMICAL_PREP_LOCATIONS.map(location => location.code), [
  'A1', 'A2', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'C5', 'T1', 'T2',
])
assert.equal(INITIAL_POSITION_ASSIGNMENTS.length, 25)
assert.deepEqual(INITIAL_POSITION_ASSIGNMENTS.filter(x => x.positionCode === 'B3').map(x => x.name), [
  'Acetic acid', 'Ethanol', 'Formic acid',
])
assert.deepEqual(INITIAL_POSITION_ASSIGNMENTS.filter(x => x.positionCode === 'B4').map(x => x.name), [
  'Permount/Toluene solution', 'Propan-2-ol', 'Xylene',
])
assert.deepEqual(LOCATION_GROUP_COLORS, {
  A: '#1557C0', B: '#137333', C: '#F04B00', T: '#642A91',
})

assert.equal(normalizeChemicalName('  PROPAN-2-OL '), 'propan-2-ol')
assert.equal(normalizeChemicalName(' Papanicolaou’s   solution 1a '), 'papanicolaou’s solution 1a')
assert.equal(normalizeCasNumber(' 64 - 19 - 7 '), '64-19-7')
assert.equal(normalizeCasNumber(''), null)

assert.deepEqual(calculateHoldingTotal([{ value: 500, unit: 'mL', count: 7 }]), { value: 3.5, unit: 'L' })
assert.deepEqual(calculateHoldingTotal([{ value: 500, unit: 'mL', count: 1 }]), { value: 500, unit: 'mL' })
assert.deepEqual(calculateHoldingTotal([{ value: 250, unit: 'g', count: 4 }]), { value: 1, unit: 'kg' })
assert.deepEqual(calculateHoldingTotal([{ value: 2.5, unit: 'L', count: 1 }, { value: 1, unit: 'L', count: 1 }]), { value: 3.5, unit: 'L' })
assert.throws(() => calculateHoldingTotal([{ value: 1, unit: 'L', count: 1 }, { value: 1, unit: 'g', count: 1 }]), /mass and volume/i)
assert.throws(() => calculateHoldingTotal([{ value: -1, unit: 'L', count: 1 }]), /non-negative/i)
assert.throws(() => calculateHoldingTotal([{ value: Number.MAX_VALUE, unit: 'L', count: 2 }]), /finite/i)
assert.throws(() => calculateHoldingTotal([{ value: Number.MAX_VALUE, unit: 'L', count: 1 }]), /finite/i)
assert.throws(() => calculateHoldingTotal([
  { value: Number.MAX_VALUE, unit: 'mL', count: 1 },
  { value: Number.MAX_VALUE, unit: 'mL', count: 1 },
]), /finite/i)

assert.equal(detectQuantityConflict({ calculated: { value: 3.5, unit: 'L' }, reportedRaw: '18 ลิตร' }), true)
assert.equal(detectQuantityConflict({ calculated: { value: 5, unit: 'L' }, reportedRaw: '5 ลิตร' }), false)
assert.equal(detectQuantityConflict({ calculated: { value: 500, unit: 'mL' }, reportedRaw: '0.5 L' }), false)
assert.equal(detectQuantityConflict({ calculated: { value: 2, unit: 'kg' }, reportedRaw: '2 kilograms' }), false)
assert.equal(detectQuantityConflict({ calculated: { value: 1, unit: 'L' }, reportedRaw: '1,000 mL' }), false)
assert.equal(detectQuantityConflict({ calculated: { value: 1.5, unit: 'L' }, reportedRaw: '1,5 L' }), false)
assert.equal(detectQuantityConflict({ calculated: { value: 1000.5, unit: 'mL' }, reportedRaw: '1,000.5 mL' }), false)
assert.equal(detectQuantityConflict({ calculated: { value: 1000.5, unit: 'mL' }, reportedRaw: '1.000,5 mL' }), false)
assert.equal(detectQuantityConflict({ calculated: { value: 1000.5, unit: 'mL' }, reportedRaw: '1,000,5 mL' }), true)
assert.equal(detectQuantityConflict({ calculated: { value: 1000.5, unit: 'mL' }, reportedRaw: '1.000.5 mL' }), true)
assert.equal(detectQuantityConflict({ calculated: { value: 500, unit: 'mL' }, reportedRaw: '500 MILLILITERS' }), false)
assert.equal(detectQuantityConflict({ calculated: { value: 2, unit: 'kg' }, reportedRaw: 'not recorded' }), true)
assert.equal(detectQuantityConflict({ calculated: { value: 2, unit: 'kg' }, reportedRaw: '  ' }), false)

assert.equal(currentSdsState({ status: 'approved', reviewDueOn: '2026-07-25' }, '2026-07-26'), 'review_due')
assert.equal(currentSdsState({ status: 'approved', reviewDueOn: '2026-07-26' }, '2026-07-26'), 'approved')
assert.equal(currentSdsState({ status: 'draft', reviewDueOn: null }, '2026-07-26'), 'draft')
assert.equal(currentSdsState({ status: null, reviewDueOn: null, matchStatus: 'mismatch' }, '2026-07-26'), 'mismatch')
assert.equal(currentSdsState({ status: null, reviewDueOn: null, matchStatus: 'missing' }, '2026-07-26'), 'missing')

console.log('chemical safety domain tests passed')
