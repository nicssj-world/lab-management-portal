import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function read(path: string): string {
  try {
    return readFileSync(resolve(process.cwd(), path), 'utf8')
  } catch {
    return ''
  }
}

const dashboardRoute = read('app/(protected)/kpi/api/satisfaction/route.ts')
const metricsRoute = read('app/(protected)/kpi/api/satisfaction/metrics/route.ts')
const manualRoute = read('app/(protected)/kpi/api/satisfaction/manual-values/route.ts')
const repository = read('lib/kpi/satisfaction-repository.ts')
const dto = read('lib/kpi/satisfaction-dashboard.ts')

assert.match(dashboardRoute, /export async function GET\(request:/, 'dashboard GET accepts query filters')
assert.match(dashboardRoute, /validateSatisfactionDashboardQuery/, 'dashboard filters are validated')
assert.match(dashboardRoute, /buildSatisfactionDashboard/, 'GET returns the shared dashboard DTO')
assert.match(dashboardRoute, /canAccessResource\([\s\S]*?'KPI',\s*'view'/, 'dashboard reads require KPI view')
assert.match(dashboardRoute, /canViewCampaign/, 'dashboard returns permission-aware campaign links')
assert.match(dashboardRoute, /status:\s*405/, 'retires the old generic satisfaction POST')
assert.doesNotMatch(dashboardRoute, /\.upsert\(/, 'the old generic POST cannot write KPI values')

assert.match(metricsRoute, /export async function GET/, 'metric catalog supports authenticated reads')
assert.match(metricsRoute, /canViewKpi[\s\S]*SATISFACTION_RESOURCE/, 'metric catalog reads require KPI or Satisfaction access')
assert.match(metricsRoute, /export async function POST/, 'metric catalog supports creation')
assert.match(metricsRoute, /export async function PATCH/, 'metric catalog supports updates')
assert.match(metricsRoute, /canAccessResource\([\s\S]*?'KPI',\s*'edit'/, 'metric writes require KPI edit')
assert.match(metricsRoute, /auditSatisfactionChange/, 'metric mutations are audited')

assert.match(manualRoute, /export async function POST/, 'manual value endpoint exists')
assert.match(manualRoute, /canAccessResource\([\s\S]*?'KPI',\s*'edit'/, 'manual writes require KPI edit')
assert.match(manualRoute, /saveManualSatisfactionValue/, 'manual writes use the guarded repository operation')
assert.match(manualRoute, /auditSatisfactionChange/, 'manual writes are audited')

assert.match(repository, /supabaseAdmin/, 'repository writes use the server-only admin client')
assert.match(repository, /survey_kpi_publications/, 'repository resolves and guards survey publications')
assert.match(repository, /survey_campaigns/, 'repository resolves campaign context and reservations')
assert.match(repository, /source_note/, 'repository persists the required manual source note')
assert.match(repository, /publishedByName/, 'repository exposes the survey publication actor')
assert.doesNotMatch(repository, /\.upsert\(/, 'manual writes never upsert over a concurrently published survey value')
assert.ok(
  repository.indexOf('const existingValueResult = await') < repository.indexOf('const [campaignResult, publicationResult]'),
  'reads the existing value before checking the publication lock to close the survey overwrite race',
)

for (const field of [
  'fiscalYear', 'years', 'activeMetrics', 'pendingPublication', 'previousValue', 'delta',
  'responseCount', 'campaignId', 'campaignName', 'departmentName', 'surveyCode', 'publishedAt', 'publishedByName',
]) {
  assert.ok(dto.includes(field), `dashboard DTO exports ${field}`)
}

console.log('KPI satisfaction API contract tests passed')
