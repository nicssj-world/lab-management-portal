import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => {
  const full = join(process.cwd(), path)
  return existsSync(full) ? readFileSync(full, 'utf8') : ''
}

const reportRoute = read('app/api/admin/satisfaction/reports/route.ts')
const commentExport = read('app/api/admin/satisfaction/comments/export/route.ts')
const kpiRoute = read('app/api/admin/satisfaction/campaigns/[campaignId]/publish-kpi/route.ts')
const actions = read('components/satisfaction/SatisfactionExportActions.tsx')
const activity = read('app/(protected)/staff/activity/ActivityClient.tsx')
const sql = read('scripts/satisfaction-survey-module.sql')

assert.ok(reportRoute.includes("requireResource('แบบสำรวจความพึงพอใจ', 'view')"))
assert.ok(reportRoute.includes(".eq('survey_id', campaign.survey_id)"), 'scopes prior-year comparison to the same survey')
assert.ok(actions.includes("import * as XLSX from 'xlsx'"))
assert.ok(actions.includes('XLSX.writeFile'))
assert.ok(actions.includes("new Blob([html]"))
assert.ok(actions.includes('window.print()'))
for (const word of ['formula', 'versionLabel', 'responseCount']) assert.ok(actions.includes(word))

assert.ok(commentExport.includes("actor.role === 'Admin' || actor.role === 'Manager'"))
assert.ok(commentExport.includes("requireResource('แบบสำรวจความพึงพอใจ', 'view')"))
assert.ok(kpiRoute.includes("requireResource('แบบสำรวจความพึงพอใจ', 'edit')"))
assert.ok(kpiRoute.includes("canAccessResource(actor, 'KPI', 'edit')"))
assert.ok(kpiRoute.includes("status !== 'closed'"))
assert.ok(kpiRoute.includes("from('kpi_satisfaction')"))
assert.ok(kpiRoute.includes('metric_code'))
assert.ok(kpiRoute.includes('fiscal_year'))
assert.ok(kpiRoute.includes('survey_kpi_publications'))
assert.ok(kpiRoute.includes("action: 'satisfaction.kpi.publish'"))
assert.ok(!kpiRoute.includes('text_value'))

assert.match(sql.toLowerCase(), /unique \(campaign_id\)/)
assert.match(sql.toLowerCase(), /unique \(metric_code, fiscal_year\)/)
assert.ok(activity.includes("'satisfaction.report.export'"))
assert.ok(activity.includes("'satisfaction.comments.export'"))
assert.ok(activity.includes("'satisfaction.kpi.publish'"))

console.log('satisfaction reporting tests passed')
