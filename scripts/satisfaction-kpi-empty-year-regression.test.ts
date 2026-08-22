import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const migrationsDirectory = join(process.cwd(), 'supabase', 'migrations')
const migrationName = readdirSync(migrationsDirectory).find((name) =>
  name.endsWith('_remove_empty_satisfaction_kpi_years.sql'),
)

assert.ok(migrationName, 'adds a migration that removes legacy empty KPI years')

const sql = readFileSync(join(migrationsDirectory, migrationName), 'utf8')
const campaignServer = readFileSync(join(process.cwd(), 'lib', 'surveys', 'campaign-server.ts'), 'utf8')
const publishRoute = readFileSync(join(process.cwd(), 'app', 'api', 'admin', 'satisfaction', 'campaigns', '[campaignId]', 'publish-kpi', 'route.ts'), 'utf8')
const dashboardDomain = readFileSync(join(process.cwd(), 'lib', 'kpi', 'satisfaction-dashboard.ts'), 'utf8')

assert.match(
  sql,
  /delete from public\.kpi_satisfaction[\s\S]*value is null[\s\S]*not exists[\s\S]*survey_kpi_publications/i,
  'removes only empty KPI rows that are not backed by a survey publication',
)
assert.match(sql, /alter column value set not null/i, 'future KPI years require a real value')
assert.match(
  sql,
  /guard_satisfaction_campaign_metric_slot[\s\S]*value\.value is not null/i,
  'campaign reservations only treat a real KPI result as a collision',
)
assert.match(
  campaignServer,
  /from\('kpi_satisfaction'\)[\s\S]{0,180}\.not\('value',\s*'is',\s*null\)/,
  'campaign API ignores legacy empty KPI rows during a rolling deployment',
)
assert.match(
  publishRoute,
  /from\('kpi_satisfaction'\)[\s\S]{0,240}\.not\('value',\s*'is',\s*null\)/,
  'publish collision check also ignores legacy empty KPI rows',
)
assert.match(
  dashboardDomain,
  /input\.values\.filter\(\(value\) => value\.value !== null\)/,
  'dashboard history does not turn empty legacy rows into fiscal-year results',
)

console.log('satisfaction KPI empty-year regression passed')
