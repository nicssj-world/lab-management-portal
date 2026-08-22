import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const migrationsDirectory = join(process.cwd(), 'supabase', 'migrations')
const migrationFiles = readdirSync(migrationsDirectory).filter((name) =>
  name.endsWith('_satisfaction_kpi_campaign_model.sql'),
)

assert.equal(
  migrationFiles.length,
  1,
  'exactly one satisfaction KPI campaign model migration exists',
)

const sql = readFileSync(join(migrationsDirectory, migrationFiles[0]!), 'utf8')
const finalizationSql = readFileSync(join(process.cwd(), 'scripts', 'satisfaction-kpi-finalize.sql'), 'utf8')

function assertContains(pattern: RegExp, message: string) {
  assert.match(sql, pattern, message)
}

// KPI metric master and legacy backfill.
assertContains(
  /create table if not exists public\.kpi_satisfaction_metrics\s*\([\s\S]*?code\s+text\s+primary key[\s\S]*?name\s+text\s+not null[\s\S]*?target\s+numeric\s+not null\s+default\s+80[\s\S]*?is_active\s+boolean\s+not null\s+default\s+true[\s\S]*?created_at\s+timestamptz\s+not null\s+default\s+now\(\)[\s\S]*?updated_at\s+timestamptz\s+not null\s+default\s+now\(\)[\s\S]*?\);/i,
  'metric master has the required columns and defaults',
)
assertContains(/check\s*\(btrim\(name\)\s*<>\s*''\)/i, 'metric names must be nonempty')
assertContains(
  /check\s*\(target\s+between\s+0\s+and\s+100\)/i,
  'metric targets stay between 0 and 100',
)

const latestCodeSelections = sql.match(/distinct on\s*\(metric_code\)/gi) ?? []
assert.ok(latestCodeSelections.length >= 2, 'backfill resolves latest name and target independently')
assertContains(
  /from\s+public\.kpi_satisfaction[\s\S]*?order by\s+metric_code\s*,\s*fiscal_year\s+desc/i,
  'backfill chooses the latest fiscal-year name',
)
assertContains(
  /where\s+target_val\s+is\s+not\s+null[\s\S]*?order by\s+metric_code\s*,\s*fiscal_year\s+desc/i,
  'backfill chooses the latest non-null legacy target',
)
assertContains(
  /insert into\s+public\.kpi_satisfaction_metrics\s*\(\s*code\s*,\s*name\s*,\s*target\s*,\s*is_active\s*\)[\s\S]*?coalesce\s*\([^)]*target_val\s*,\s*80\s*\)[\s\S]*?on conflict\s*\(code\)\s+do nothing/i,
  'backfill preserves exact codes and defaults missing targets to 80',
)
assert.doesNotMatch(sql, /lower\s*\(\s*metric_code\s*\)/i, 'legacy metric codes are not normalized')
assert.doesNotMatch(sql, /drop\s+column\s+(?:if exists\s+)?(?:metric_name|target_val)/i, 'legacy KPI columns remain')

// RLS and table privileges for the exposed master table.
assertContains(
  /alter table public\.kpi_satisfaction_metrics enable row level security/i,
  'metric master enables RLS',
)
assertContains(
  /revoke all on table public\.kpi_satisfaction_metrics from anon\s*,\s*authenticated/i,
  'API roles start with no metric-master privileges',
)
assertContains(
  /grant select on table public\.kpi_satisfaction_metrics to authenticated/i,
  'authenticated users can read metric master data',
)
assertContains(
  /grant select\s*,\s*insert\s*,\s*update\s*,\s*delete on table public\.kpi_satisfaction_metrics to service_role/i,
  'service role has metric-master CRUD',
)

const metricPolicies = sql
  .split(';')
  .filter((statement) => /create policy/i.test(statement) && /on public\.kpi_satisfaction_metrics/i.test(statement))
assert.equal(metricPolicies.length, 1, 'metric master defines exactly one policy')
assert.match(metricPolicies[0]!, /for select\s+to authenticated\s+using\s*\(true\)/i)
assert.doesNotMatch(sql, /auth\.role\s*\(/i, 'migration does not use deprecated auth.role() policies')

// Additive campaign model and constraints.
for (const columnPattern of [
  /add column if not exists fiscal_year\s+integer/i,
  /add column if not exists department_id\s+bigint/i,
  /add column if not exists target_response_count\s+integer/i,
  /add column if not exists kpi_metric_code\s+text/i,
]) {
  assertContains(columnPattern, `campaign migration contains ${columnPattern.source}`)
}
assertContains(/check\s*\(fiscal_year\s+between\s+2500\s+and\s+3000\)/i, 'campaign fiscal year is bounded')
assertContains(/check\s*\(target_response_count\s*>\s*0\)/i, 'response target must be positive')
assertContains(
  /foreign key\s*\(department_id\)\s+references public\.departments\s*\(id\)\s+on delete restrict/i,
  'campaign department uses a restrictive foreign key',
)
assertContains(
  /foreign key\s*\(kpi_metric_code\)\s+references public\.kpi_satisfaction_metrics\s*\(code\)\s+on delete restrict/i,
  'campaign KPI code references the metric master',
)
assertContains(
  /foreign key\s*\(metric_code\)\s+references public\.kpi_satisfaction_metrics\s*\(code\)\s+on delete restrict/i,
  'legacy KPI rows reference the metric master',
)
assertContains(/add column if not exists source_note\s+text/i, 'manual KPI values have a source note')

assertContains(
  /create unique index if not exists survey_campaigns_survey_department_fiscal_year_uidx\s+on public\.survey_campaigns\s*\(survey_id\s*,\s*department_id\s*,\s*fiscal_year\)/i,
  'one survey campaign exists per department and fiscal year',
)
assertContains(
  /create unique index if not exists survey_campaigns_kpi_metric_fiscal_year_uidx\s+on public\.survey_campaigns\s*\(kpi_metric_code\s*,\s*fiscal_year\)\s+where\s+kpi_metric_code\s+is not null\s+and\s+fiscal_year\s+is not null/i,
  'KPI metric/year uniqueness is partial while legacy mappings remain null',
)
assertContains(/create index if not exists survey_campaigns_fiscal_year_department_idx/i, 'campaign dashboard join index exists')
assertContains(/create index if not exists kpi_satisfaction_fiscal_year_metric_idx/i, 'KPI year-first dashboard index exists')
assertContains(/create index if not exists survey_kpi_publications_published_at_idx/i, 'publication recency index exists')
assertContains(/pg_advisory_xact_lock/i, 'campaign and manual writes serialize the same metric/year slot')
assertContains(/create trigger satisfaction_campaign_metric_slot_guard/i, 'campaign writes have a cross-table reservation guard')
assertContains(/create trigger satisfaction_value_metric_slot_guard/i, 'manual KPI writes have a cross-table reservation guard')
assertContains(/survey_kpi_publications/i, 'the slot guard permits the matching survey publication transaction')
assertContains(/pg_constraint/i, 'additive constraints use catalog guards')

const guardedConstraintBlocks = sql.match(/do\s+\$\$[\s\S]*?\$\$;/gi) ?? []
assert.ok(guardedConstraintBlocks.length >= 5, 'all additive constraints use guarded DO blocks')
for (const block of guardedConstraintBlocks) {
  assert.match(block, /end;\s*\$\$;$/i, 'each guarded DO block is valid PL/pgSQL')
}

// Exact FY2569 campaign backfill; KPI mappings intentionally remain unset.
const campaignMappings = [
  ['b03f97d5-acaf-4cc8-9720-70354fdcb63f', 'MCL'],
  ['9d319578-7af4-4421-84fa-e392d24f2298', 'OPD'],
  ['c4f1b570-8c89-4f54-b50f-f9dd1b6a408f', 'OPD'],
  ['1448036f-3ef7-4b81-b89b-675c34f21d85', 'MCL'],
] as const

for (const [campaignId, departmentCode] of campaignMappings) {
  assertContains(
    new RegExp(`${campaignId.replaceAll('-', '\\-')}[':]?::uuid\\s*,\\s*'${departmentCode}'`, 'i'),
    `${campaignId} maps to ${departmentCode}`,
  )
}
assertContains(/fiscal_year\s*=\s*2569/i, 'legacy campaigns are assigned FY2569')
assertContains(/2025-10-01T00:00:00\+07:00/i, 'FY2569 opens at the Thai fiscal-year boundary')
assertContains(/2026-10-01T00:00:00\+07:00/i, 'FY2569 closes at the next Thai fiscal-year boundary')
assertContains(/join\s+public\.departments[\s\S]*?code\s*=\s*mapping\.department_code/i, 'department IDs come from exact department codes')

assert.doesNotMatch(sql, /kpi_metric_code\s+text\s+not null/i, 'campaign KPI mapping remains nullable')
assert.doesNotMatch(sql, /alter column\s+kpi_metric_code\s+set not null/i, 'migration does not prematurely require KPI mappings')
assert.doesNotMatch(sql, /set[\s\S]{0,200}kpi_metric_code\s*=/i, 'campaign backfill does not guess KPI mappings')
assert.match(
  finalizationSql,
  /where fiscal_year is null[\s\S]*department_id is null[\s\S]*kpi_metric_code is null/i,
  'final constraint rollout fails closed while any campaign metadata is incomplete',
)
assert.match(finalizationSql, /alter column\s+kpi_metric_code\s+set not null/i, 'final rollout makes campaign KPI mapping mandatory')

// This slice must not rewrite submission identity, counts, or response data.
assert.doesNotMatch(sql, /\b(?:delete from|truncate)\b/i, 'migration does not remove data')
assert.doesNotMatch(sql, /update\s+public\.survey_(?:responses|answers|response_events|response_devices)/i, 'response data is untouched')
assert.doesNotMatch(sql, /\bpublic_token\b|\bresponse_count\b|\bsurvey_version_id\b/i, 'tokens, counts, and bound survey versions are untouched')
assert.doesNotMatch(
  sql,
  /update\s+public\.survey_campaigns[\s\S]*?set[\s\S]*?updated_at\s*=/i,
  'campaign backfill does not reorder existing campaigns through audit timestamps',
)

const masterBackfillPosition = sql.search(/insert into\s+public\.kpi_satisfaction_metrics/i)
const legacyKpiForeignKeyPosition = sql.search(/constraint\s+kpi_satisfaction_metric_code_fkey/i)
assert.ok(masterBackfillPosition >= 0 && legacyKpiForeignKeyPosition > masterBackfillPosition, 'legacy codes are backfilled before adding the KPI foreign key')

console.log('satisfaction KPI schema contract passed')
