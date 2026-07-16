import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => {
  const full = join(process.cwd(), path)
  return existsSync(full) ? readFileSync(full, 'utf8') : ''
}

const comments = read('components/satisfaction/SurveyComments.tsx')
const route = read('app/api/admin/satisfaction/comments/route.ts')

assert.ok(comments.includes("useState('')"), 'keeps filter state in the comments UI')
assert.ok(comments.includes('aria-label="กรองแบบสำรวจ"'), 'offers a survey-form filter')
assert.ok(comments.includes('aria-label="ค้นหาความคิดเห็น"'), 'offers a searchable comments input')
assert.ok(comments.includes('surveyId'), 'sends the selected survey form to the API')
assert.ok(comments.includes('survey_campaigns?.surveys?.code'), 'shows each comment survey code')
assert.ok(comments.includes('survey_campaigns?.surveys?.title'), 'shows each comment survey title')
assert.ok(comments.includes('survey_campaigns?.survey_versions?.version_number'), 'shows each comment survey version')

assert.ok(route.includes("params.get('surveyId')"), 'reads the survey-form filter')
assert.ok(route.includes('survey_campaigns!inner'), 'uses an inner join when filtering the parent comments by campaign')
assert.ok(route.includes(".eq('survey_campaigns.survey_id', surveyId)"), 'filters comments by survey form on the server')
assert.ok(route.includes(".ilike('text_value'"), 'keeps comment text search server-side')

console.log('satisfaction comment context tests passed')
