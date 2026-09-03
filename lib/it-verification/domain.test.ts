import assert from 'node:assert/strict'
import test from 'node:test'
import {
  IT_DEPARTMENTS,
  deterministicLnRank,
  getMonthlyQuota,
  getQuarterFromMonth,
  normalizeLn,
  pickDeterministicSamples,
  departmentCodeForProfileDepartment,
  TAT_SECTION_SEEDS,
  type ItDepartmentCode,
} from './domain'
import { isRoundReady, statusLabel } from './status'
import { SampleResultSchema, sampleUpdateSchema } from './validation'

test('the verification plan uses calendar quarters and 3/3/4 monthly quotas', () => {
  assert.equal(getQuarterFromMonth(1), 1)
  assert.equal(getQuarterFromMonth(3), 1)
  assert.equal(getQuarterFromMonth(4), 2)
  assert.equal(getQuarterFromMonth(12), 4)
  assert.deepEqual([1, 2, 3].map(getMonthlyQuota), [3, 3, 4])
  assert.deepEqual([4, 5, 6].map(getMonthlyQuota), [3, 3, 4])
  assert.throws(() => getQuarterFromMonth(0), /เดือน/)
  assert.throws(() => getMonthlyQuota(13), /เดือน/)
})

test('department registry contains exactly the seven target departments', () => {
  assert.deepEqual(IT_DEPARTMENTS.map((department) => department.code), ['CHE', 'IMM', 'HEM', 'MIS', 'MIC', 'MOL', 'BLB'])
  assert.equal(new Set(IT_DEPARTMENTS.map((department) => department.id)).size, 7)
  assert.deepEqual(TAT_SECTION_SEEDS.map((seed) => seed.code), ['CHE', 'IMM', 'HEM', 'MIS', 'MIC', 'MOL', 'BLB'])
  assert.equal(departmentCodeForProfileDepartment('งานเคมีคลินิก'), 'CHE')
  assert.equal(departmentCodeForProfileDepartment('POCT2'), null)
})

test('LN normalization removes surrounding whitespace and rejects empty values', () => {
  assert.equal(normalizeLn('  LN-0007  '), 'LN-0007')
  assert.equal(normalizeLn('\tLN-0007\n'), 'LN-0007')
  assert.equal(normalizeLn('   '), null)
  assert.equal(normalizeLn(null), null)
})

test('deterministic ranking is stable and different seeds produce different ranking inputs', () => {
  assert.equal(deterministicLnRank('seed-a', 'LN-1'), deterministicLnRank('seed-a', 'LN-1'))
  assert.notEqual(deterministicLnRank('seed-a', 'LN-1'), deterministicLnRank('seed-b', 'LN-1'))
})

test('sample picker is distinct, deterministic and respects prior active samples', () => {
  const population = [' LN-3 ', 'LN-1', 'LN-2', 'LN-1', '', null, 'LN-4']
  const first = pickDeterministicSamples({ seed: 'seed-a', population, quota: 3, excluded: new Set(['LN-2']) })
  const second = pickDeterministicSamples({ seed: 'seed-a', population, quota: 3, excluded: new Set(['LN-2']) })
  assert.deepEqual(first, second)
  assert.equal(first.length, 3)
  assert.equal(new Set(first).size, first.length)
  assert.equal(first.includes('LN-2'), false)
  assert.deepEqual(pickDeterministicSamples({ seed: 'seed-a', population, quota: 20, excluded: new Set() }).sort(), ['LN-1', 'LN-2', 'LN-3', 'LN-4'])
})

test('sample result accepts pass, fail, na and empty draft state only where intended', () => {
  for (const result of ['pass', 'fail', 'na', null]) assert.equal(SampleResultSchema.parse(result), result)
  assert.throws(() => SampleResultSchema.parse('yes'))
  assert.deepEqual(sampleUpdateSchema.parse({ lisToHis: 'pass', sourceToLis: 'na', remark: 'ไม่เกี่ยวข้อง' }).sourceToLis, 'na')
  assert.throws(() => sampleUpdateSchema.parse({ lisToHis: 'pass', sourceToLis: 'na', remark: '' }), /remark/i)
})

test('round readiness requires all active samples complete and every failed point resolved', () => {
  assert.equal(isRoundReady({ target: 2, samples: 2, incomplete: 0, openFindings: 0 }), true)
  assert.equal(isRoundReady({ target: 2, samples: 1, incomplete: 0, openFindings: 0 }), false)
  assert.equal(isRoundReady({ target: 2, samples: 2, incomplete: 1, openFindings: 0 }), false)
  assert.equal(isRoundReady({ target: 2, samples: 2, incomplete: 0, openFindings: 1 }), false)
  assert.equal(statusLabel('reviewed'), 'ล็อกแล้ว')
})

test('department code remains a narrow union for API consumers', () => {
  const code: ItDepartmentCode = 'CHE'
  assert.equal(code, 'CHE')
})
