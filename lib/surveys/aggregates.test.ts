import assert from 'node:assert/strict'
import { aggregateSurveyResults } from './aggregates'
import type { SurveyVersionDefinition } from './types'

const definition: SurveyVersionDefinition = {
  id: 'v1', surveyId: 's1', versionNumber: 1, title: 'ทดสอบ', status: 'published',
  sections: [
    { id: 'profile', sectionKey: 'profile', title: 'ข้อมูลทั่วไป', sortOrder: 1, questions: [
      { id: 'sex', questionKey: 'sex', sectionId: 'profile', prompt: 'เพศ', type: 'single_choice', required: false, sortOrder: 1, options: [
        { id: 'female', optionKey: 'female', label: 'หญิง', value: 'female', sortOrder: 1 },
        { id: 'male', optionKey: 'male', label: 'ชาย', value: 'male', sortOrder: 2 },
      ] },
    ] },
    { id: 'service', sectionKey: 'service', title: 'บริการ', sortOrder: 2, questions: [
      { id: 'q1', questionKey: 'q1', sectionId: 'service', prompt: 'ความรวดเร็ว', type: 'rating_scale', required: true, sortOrder: 1, positiveThreshold: 4, options: [1,2,3,4,5].map((score) => ({ id: `q1-${score}`, optionKey: `s${score}`, label: String(score), value: String(score), score, sortOrder: score })) },
    ] },
    { id: 'quality', sectionKey: 'quality', title: 'คุณภาพ', sortOrder: 3, questions: [
      { id: 'q2', questionKey: 'q2', sectionId: 'quality', prompt: 'ความเชื่อมั่น', type: 'rating_scale', required: false, sortOrder: 1, positiveThreshold: 4, options: [1,2,3,4,5].map((score) => ({ id: `q2-${score}`, optionKey: `s${score}`, label: String(score), value: String(score), score, sortOrder: score })) },
    ] },
  ],
}

const result = aggregateSurveyResults(definition, [
  { responseId: 'r1', submittedAt: '2026-07-01T02:00:00.000Z', answers: [
    { questionId: 'sex', optionId: 'female', score: null },
    { questionId: 'q1', optionId: 'q1-5', score: 5 },
    { questionId: 'q2', optionId: 'q2-4', score: 4 },
  ] },
  { responseId: 'r2', submittedAt: '2026-07-02T02:00:00.000Z', answers: [
    { questionId: 'sex', optionId: 'male', score: null },
    { questionId: 'q1', optionId: 'q1-3', score: 3 },
  ] },
])

assert.equal(result.responseCount, 2)
assert.equal(result.overall.normalizedPct, 80)
assert.equal(result.overall.positivePct, 66.67)
assert.equal(result.overall.validAnswerCount, 3)
assert.deepEqual(result.overall.distribution, { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 })
assert.equal(result.sections.find((section) => section.sectionId === 'service')?.normalizedPct, 80)
assert.equal(result.questions.find((question) => question.questionId === 'q1')?.answerCount, 2)
assert.equal(result.questions.find((question) => question.questionId === 'q2')?.answerCount, 1)
assert.equal(result.trend.length, 2)
assert.deepEqual(result.demographics.sex, { female: 1, male: 1 })

const monthly = aggregateSurveyResults(definition, [
  { responseId: 'r1', submittedAt: '2026-01-02T00:00:00.000Z', answers: [{ questionId: 'q1', optionId: 'q1-5', score: 5 }] },
  { responseId: 'r2', submittedAt: '2026-03-02T00:00:00.000Z', answers: [{ questionId: 'q1', optionId: 'q1-4', score: 4 }] },
], 'month')
assert.deepEqual(monthly.trend.map((point) => point.period), ['2026-01', '2026-03'])

console.log('aggregate tests passed')
