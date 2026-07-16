import assert from 'node:assert/strict'
import { validateSubmission } from './validation'

const definition = {
  id: 'version-1',
  surveyId: 'survey-1',
  versionNumber: 1,
  title: 'แบบทดสอบ',
  status: 'published',
  sections: [
    {
      id: 'section-1',
      sectionKey: 'profile',
      title: 'ข้อมูลทั่วไป',
      sortOrder: 1,
      questions: [
        {
          id: 'choice-1',
          questionKey: 'role',
          sectionId: 'section-1',
          prompt: 'บทบาท',
          type: 'single_choice',
          required: true,
          sortOrder: 1,
          options: [
            { id: 'option-1', optionKey: 'doctor', label: 'แพทย์', value: 'doctor', sortOrder: 1 },
            { id: 'option-2', optionKey: 'other', label: 'อื่น ๆ', value: 'other', sortOrder: 2, allowsOtherText: true },
          ],
        },
        {
          id: 'number-1',
          questionKey: 'age',
          sectionId: 'section-1',
          prompt: 'อายุ',
          type: 'number',
          required: false,
          sortOrder: 2,
          min: 1,
          max: 120,
        },
        {
          id: 'rating-1',
          questionKey: 'service',
          sectionId: 'section-1',
          prompt: 'ความพึงพอใจ',
          type: 'rating_scale',
          required: true,
          sortOrder: 3,
          allowDetailText: true,
          positiveThreshold: 4,
          options: [1, 2, 3, 4, 5].map((score) => ({
            id: `score-${score}`,
            optionKey: `score_${score}`,
            label: String(score),
            value: String(score),
            score,
            sortOrder: score,
          })),
        },
        {
          id: 'comment-1',
          questionKey: 'comment',
          sectionId: 'section-1',
          prompt: 'ข้อเสนอแนะ',
          type: 'long_text',
          required: false,
          sortOrder: 4,
          isComment: true,
        },
      ],
    },
  ],
} as const

const valid = validateSubmission(definition, [
  { questionId: 'choice-1', optionId: 'option-2', textValue: 'นักเทคนิคการแพทย์' },
  { questionId: 'number-1', numericValue: 35 },
  { questionId: 'rating-1', optionId: 'score-5', detailText: 'รวดเร็วมาก' },
  { questionId: 'comment-1', textValue: 'บริการดี' },
])

assert.equal(valid.ok, true)
if (valid.ok) {
  assert.equal(valid.answers.length, 4)
  assert.equal(valid.answers[2]?.score, 5)
  assert.equal(valid.answers[2]?.maxScore, 5)
}

const required = validateSubmission(definition, [])
assert.equal(required.ok, false)
if (!required.ok) {
  assert.deepEqual(
    required.issues.filter((issue) => issue.message.includes('จำเป็น')).map((issue) => issue.questionId),
    ['choice-1', 'rating-1'],
  )
}

const invalid = validateSubmission(definition, [
  { questionId: 'unknown', textValue: 'x' },
  { questionId: 'choice-1', optionId: 'score-1' },
  { questionId: 'number-1', numericValue: 121 },
  { questionId: 'rating-1', optionId: 'score-4', detailText: 'ก'.repeat(501) },
  { questionId: 'comment-1', textValue: 'ข'.repeat(4001) },
])
assert.equal(invalid.ok, false)
if (!invalid.ok) {
  assert.equal(invalid.issues.some((issue) => issue.questionId === 'unknown'), true)
  assert.equal(invalid.issues.some((issue) => issue.questionId === 'choice-1'), true)
  assert.equal(invalid.issues.some((issue) => issue.questionId === 'number-1'), true)
  assert.equal(invalid.issues.some((issue) => issue.message.includes('500')), true)
  assert.equal(invalid.issues.some((issue) => issue.message.includes('4,000')), true)
}

const oversized = validateSubmission(definition, [
  { questionId: 'choice-1', optionId: 'option-1' },
  { questionId: 'rating-1', optionId: 'score-5' },
  { questionId: 'comment-1', textValue: 'x'.repeat(70_000) },
])
assert.equal(oversized.ok, false)
if (!oversized.ok) {
  assert.equal(oversized.issues.some((issue) => issue.message.includes('64 KiB')), true)
}

console.log('validation tests passed')
