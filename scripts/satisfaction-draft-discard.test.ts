import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const sql = read('scripts/satisfaction-survey-module.sql')
const migration = read('scripts/satisfaction-draft-discard.sql')
const server = read('lib/surveys/server.ts')
const schemas = read('lib/surveys/schemas.ts')
const route = read('app/api/admin/satisfaction/surveys/[surveyId]/draft/route.ts')
const builder = read('components/satisfaction/SurveyBuilder.tsx')

assert.match(sql, /create or replace function public\.discard_survey_draft\(/i)
assert.match(sql, /for update/i)
assert.match(sql, /delete from public\.survey_versions/i)
assert.match(sql, /set archived_at = coalesce\(archived_at, now\(\)\)/i)
assert.match(sql, /grant execute on function public\.discard_survey_draft/i)
assert.match(migration, /create or replace function public\.discard_survey_draft\(/i)
assert.match(migration, /set search_path = ''/i)
assert.match(migration, /grant execute on function public\.discard_survey_draft/i)

assert.match(server, /export async function discardSurveyDraft\(/)
assert.match(server, /\.rpc\('discard_survey_draft'/)
assert.match(schemas, /export const discardDraftSchema = z\.object\(\{ versionId: z\.string\(\)\.uuid\(\) \}\)/)
assert.match(route, /export async function DELETE/)
assert.match(route, /requireResource\('แบบสำรวจความพึงพอใจ', 'edit'\)/)
assert.match(route, /discardDraftSchema\.safeParse/)
assert.match(builder, /ยกเลิกฉบับร่าง/)
assert.match(builder, /method: 'DELETE'/)
assert.match(builder, /aria-modal="true"/)
assert.match(builder, /result\.action === 'archived'/)

console.log('Satisfaction draft discard checks passed.')
