import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(join(process.cwd(), 'scripts/satisfaction-survey-module.sql'), 'utf8')
const normalized = sql.toLowerCase().replace(/\s+/g, ' ')

const tables = [
  'surveys',
  'survey_versions',
  'survey_sections',
  'survey_questions',
  'survey_question_options',
  'survey_campaigns',
  'survey_responses',
  'survey_answers',
  'survey_response_devices',
  'survey_response_events',
  'survey_kpi_publications',
]

for (const table of tables) {
  assert.ok(
    normalized.includes(`create table if not exists public.${table}`),
    `creates ${table}`,
  )
  assert.ok(
    normalized.includes(`alter table public.${table} enable row level security`),
    `enables RLS on ${table}`,
  )
}

assert.match(normalized, /unique \(survey_id, version_number\)/)
assert.match(normalized, /unique \(campaign_id, submission_key\)/)
assert.match(normalized, /unique \(campaign_id, device_hash\)/)
assert.match(normalized, /create unique index [^;]+survey_versions[^;]+where status = 'draft'/)
assert.match(normalized, /create or replace function public\.submit_survey_response/)
assert.match(normalized, /security definer set search_path = ''/)
assert.match(normalized, /revoke all on function public\.submit_survey_response[^;]+ from public/)
assert.match(normalized, /revoke all on function public\.submit_survey_response[^;]+ from anon/)
assert.match(normalized, /revoke all on function public\.submit_survey_response[^;]+ from authenticated/)
assert.match(normalized, /grant execute on function public\.submit_survey_response[^;]+ to service_role/)
assert.match(normalized, /alter publication supabase_realtime add table public\.survey_response_events/)
assert.ok(!normalized.includes('grant select on public.survey_answers to anon'))
assert.ok(!normalized.includes('grant insert on public.survey_responses to anon'))
assert.ok(normalized.includes('แบบสำรวจความพึงพอใจ:view'))
assert.ok(normalized.includes('แบบสำรวจความพึงพอใจ:edit'))

const expectedCounts = new Map([
  ['FM-QP-LAB-09-01', 11],
  ['FM-QP-LAB-09-02', 9],
  ['FM-QP-LAB-09-03', 6],
  ['FM-QP-LAB-09-04', 15],
])

for (const [code, expected] of expectedCounts) {
  const start = sql.indexOf(`-- SEED ${code}`)
  const end = sql.indexOf('-- END SEED', start)
  assert.ok(start >= 0 && end > start, `has seed block ${code}`)
  const block = sql.slice(start, end)
  assert.equal(
    (block.match(/"type"\s*:\s*"rating_scale"/g) ?? []).length,
    expected,
    `${code} rating count`,
  )
}

assert.match(normalized, /published_at/)
assert.match(normalized, /prevent_published_survey_version_changes/)
assert.match(normalized, /if tg_op = 'delete' then/)
assert.match(normalized, /return old;/)
assert.ok(!normalized.includes('return coalesce(new, old)'))
assert.match(normalized, /survey_response_events_staff_read/)

console.log('survey SQL contract tests passed')
