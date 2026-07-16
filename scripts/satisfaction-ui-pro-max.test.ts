import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const staff = read('components/satisfaction/SatisfactionModule.tsx')
const campaigns = read('components/satisfaction/CampaignManager.tsx')
const publicPage = read('app/s/[token]/page.tsx')
const publicForm = read('components/satisfaction/PublicSurveyForm.tsx')
const renderer = read('components/satisfaction/SurveyRenderer.tsx')

assert.match(staff, /PageHeader/, 'staff survey page should use the shared module header')
assert.doesNotMatch(staff, /satisfaction-hero/, 'staff survey page should not duplicate dashboard context in a hero')
assert.match(staff, /satisfaction-summary-card/, 'staff metrics should use cohesive summary cards')
assert.match(campaigns, /campaign-manager/, 'campaign controls should use their own responsive UI shell')
assert.match(campaigns, /campaign-create-panel/, 'campaign creation should be presented as a focused panel')

assert.match(publicPage, /public-survey-page/, 'public form should have a dedicated calm page canvas')
assert.match(publicForm, /public-survey-progress/, 'respondents should see survey progress')
assert.match(publicForm, /role="progressbar"/, 'survey progress should be announced semantically')
assert.match(publicForm, /public-survey-trust/, 'anonymity assurance should be visually distinct')
assert.doesNotMatch(publicForm, /⌛/, 'terminal state should use the shared icon system instead of emoji-like glyphs')
assert.match(renderer, /data-question-type=\{question.type\}/, 'question type should drive responsive answer layouts')
assert.match(renderer, /survey-renderer-public/, 'public answer controls should have a dedicated visual treatment')
assert.match(renderer, /min-height:48px/, 'public answer controls should have touch-friendly targets')

console.log('satisfaction UI pro max checks passed')
