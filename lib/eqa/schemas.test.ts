import assert from 'node:assert/strict'
import { capaSchema, coverageSchema, programSchema, resultSchema, roundSchema } from './schemas'

assert.equal(programSchema.safeParse({ providerId: crypto.randomUUID(), fiscalYearBe: 2569, name: 'Chemistry PT', programType: 'eqa_pt', active: true, ownerIds: [] }).success, true)
assert.equal(programSchema.safeParse({ providerId: crypto.randomUUID(), fiscalYearBe: 2400, name: '', programType: 'other' }).success, false)

assert.equal(coverageSchema.safeParse({ testId: 1, fiscalYearBe: 2569, mode: 'required_eqa' }).success, true)
assert.equal(coverageSchema.safeParse({ testId: 1, fiscalYearBe: 2569, mode: 'alternative', reason: '' }).success, false)
assert.equal(coverageSchema.safeParse({ testId: 1, fiscalYearBe: 2569, mode: 'not_applicable', reason: 'No applicable scheme' }).success, true)

assert.equal(roundSchema.safeParse({ programId: crypto.randomUUID(), roundCode: 'R1', submissionDueOn: '2026-08-01', status: 'planned' }).success, true)
assert.equal(resultSchema.safeParse({ programTestId: crypto.randomUUID(), outcome: 'not_evaluated', reason: '' }).success, false)
assert.equal(resultSchema.safeParse({ programTestId: crypto.randomUUID(), outcome: 'unacceptable' }).success, true)

assert.equal(capaSchema.safeParse({ roundId: crypto.randomUUID(), title: 'Bias', rootCause: 'Calibration', correctiveAction: 'Recalibrate', ownerId: crypto.randomUUID(), dueOn: '2026-08-01', resultIds: [crypto.randomUUID()] }).success, true)

console.log('lib/eqa/schemas.test.ts: all assertions passed')
