import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const campaignServer = read('lib/surveys/campaign-server.ts')
const campaignListServer = read('lib/surveys/server.ts')
const reportRoute = read('app/api/admin/satisfaction/reports/route.ts')
const publishRoute = read('app/api/admin/satisfaction/campaigns/[campaignId]/publish-kpi/route.ts')
const publicRoute = read('app/api/satisfaction/[token]/route.ts')

for (const column of ['fiscal_year', 'department_id', 'target_response_count', 'kpi_metric_code']) {
  assert.ok(campaignServer.includes(column), `campaign mutations use ${column}`)
  assert.ok(campaignListServer.includes(column), `campaign DTO exposes ${column}`)
}
assert.ok(campaignServer.includes("from('departments')"), 'validates department master')
assert.ok(campaignServer.includes("from('kpi_satisfaction_metrics')"), 'validates KPI metric master')
assert.ok(campaignServer.includes("from('kpi_satisfaction')"), 'locks existing KPI metric/year collisions')

assert.ok(!reportRoute.includes("params.get('fiscalYear')"), 'report year comes from campaign')
assert.ok(reportRoute.includes('campaign.fiscal_year'))
assert.ok(reportRoute.includes(".eq('department_id', campaign.department_id)"), 'previous comparison is department scoped')
assert.ok(reportRoute.includes('if (!campaign.departments'), 'report fails clearly when the department relation is unavailable')

assert.ok(!publishRoute.includes('metricName: z.string'))
assert.ok(!publishRoute.includes('metricCode: z.string'))
assert.ok(!publishRoute.includes('fiscalYear: z.number'))
assert.ok(publishRoute.includes('campaign.fiscal_year'))
assert.ok(publishRoute.includes('campaign.kpi_metric_code'))
assert.ok(publishRoute.includes("from('kpi_satisfaction_metrics')"))
assert.ok(publishRoute.includes('publicationError'), 'publication collision lookup fails closed')
assert.ok(publishRoute.includes('collisionError'), 'legacy KPI collision lookup fails closed')

assert.ok(publicRoute.includes("code: 'expired'"), 'deadline race returns the public expired state')

console.log('campaign API contract tests passed')
