import assert from 'node:assert/strict'
import { calculateSurveyScore } from './scoring'

const basic = calculateSurveyScore([
  { questionId: 'q1', sectionId: 'service', score: 5, maxScore: 5, positiveThreshold: 4 },
  { questionId: 'q2', sectionId: 'service', score: 3, maxScore: 5, positiveThreshold: 4 },
])

assert.equal(basic.normalizedPct, 80)
assert.equal(basic.positivePct, 50)
assert.equal(basic.averageScore, 4)
assert.equal(basic.validAnswerCount, 2)
assert.deepEqual(basic.distribution, { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 })
assert.equal(basic.sections.service.normalizedPct, 80)

const filtered = calculateSurveyScore([
  { questionId: 'q1', sectionId: 'a', score: null, maxScore: 5, positiveThreshold: 4 },
  { questionId: 'q2', sectionId: 'a', score: Number.NaN, maxScore: 5, positiveThreshold: 4 },
  { questionId: 'q3', sectionId: 'b', score: 2.5, maxScore: 5, positiveThreshold: 3 },
  { questionId: 'q4', sectionId: 'b', score: 4, maxScore: 0, positiveThreshold: 4 },
])

assert.equal(filtered.validAnswerCount, 1)
assert.equal(filtered.normalizedPct, 50)
assert.equal(filtered.positivePct, 0)
assert.equal(filtered.averageScore, 2.5)
assert.deepEqual(filtered.distribution, { 1: 0, 2: 0, 3: 1, 4: 0, 5: 0 })

const empty = calculateSurveyScore([])
assert.equal(empty.normalizedPct, null)
assert.equal(empty.positivePct, null)
assert.equal(empty.averageScore, null)
assert.equal(empty.validAnswerCount, 0)

console.log('scoring tests passed')
