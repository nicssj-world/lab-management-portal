import assert from 'node:assert/strict'
import {
  assertCanCreateDraft,
  cloneDefinition,
  validateDefinitionForPublish,
} from './definition'
import type { RatingScaleQuestion, SurveyVersionDefinition } from './types'

const source: SurveyVersionDefinition = {
  id: 'version-1',
  surveyId: 'survey-1',
  versionNumber: 1,
  title: 'แบบสำรวจต้นฉบับ',
  status: 'published',
  publishedAt: '2026-01-01T00:00:00.000Z',
  sections: [
    {
      id: 'section-1',
      sectionKey: 'service',
      title: 'บริการ',
      sortOrder: 1,
      questions: [
        {
          id: 'question-1',
          questionKey: 'overall',
          sectionId: 'section-1',
          prompt: 'ความพึงพอใจโดยรวม',
          type: 'rating_scale',
          required: true,
          sortOrder: 1,
          positiveThreshold: 4,
          options: [1, 2, 3, 4, 5].map((score) => ({
            id: `option-${score}`,
            optionKey: `score_${score}`,
            label: String(score),
            value: String(score),
            score,
            sortOrder: score,
          })),
        },
      ],
    },
  ],
}

const cloned = cloneDefinition(source, 2)
assert.equal(cloned.versionNumber, 2)
assert.equal(cloned.status, 'draft')
assert.equal(cloned.publishedAt, null)
assert.notEqual(cloned.id, source.id)
assert.equal(cloned.sections[0]?.sectionKey, source.sections[0]?.sectionKey)
assert.notEqual(cloned.sections[0]?.id, source.sections[0]?.id)
assert.equal(
  cloned.sections[0]?.questions[0]?.questionKey,
  source.sections[0]?.questions[0]?.questionKey,
)
assert.notEqual(cloned.sections[0]?.questions[0]?.id, source.sections[0]?.questions[0]?.id)
assert.equal(
  cloned.sections[0]?.questions[0]?.type === 'rating_scale'
    ? cloned.sections[0].questions[0].options[0]?.optionKey
    : null,
  'score_1',
)
assert.notEqual(
  cloned.sections[0]?.questions[0]?.type === 'rating_scale'
    ? cloned.sections[0].questions[0].options[0]?.id
    : null,
  'option-1',
)

assert.throws(
  () => assertCanCreateDraft([{ id: 'draft', status: 'draft' }]),
  /ฉบับร่าง/,
)
assert.doesNotThrow(() => assertCanCreateDraft([{ id: 'published', status: 'published' }]))

assert.deepEqual(validateDefinitionForPublish(source), [])

const invalid: SurveyVersionDefinition = {
  ...source,
  title: ' ',
  sections: [
    {
      ...source.sections[0]!,
      title: '',
      questions: [
        {
          ...(source.sections[0]!.questions[0]! as RatingScaleQuestion),
          prompt: '',
          options: [],
          positiveThreshold: 9,
        },
        {
          id: 'number-1',
          questionKey: 'age',
          sectionId: 'section-1',
          prompt: 'อายุ',
          type: 'number',
          required: false,
          sortOrder: 2,
          min: 120,
          max: 1,
        },
      ],
    },
  ],
}

const issues = validateDefinitionForPublish(invalid)
assert.equal(issues.some((issue) => issue.path === 'title'), true)
assert.equal(issues.some((issue) => issue.path.includes('sections.0.title')), true)
assert.equal(issues.some((issue) => issue.path.includes('questions.0.prompt')), true)
assert.equal(issues.some((issue) => issue.path.includes('questions.0.options')), true)
assert.equal(issues.some((issue) => issue.path.includes('positiveThreshold')), true)
assert.equal(issues.some((issue) => issue.path.includes('questions.1.min')), true)

const noSections = validateDefinitionForPublish({ ...source, sections: [] })
assert.equal(noSections.some((issue) => issue.path === 'sections'), true)

console.log('definition tests passed')
