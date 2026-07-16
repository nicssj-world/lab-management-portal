import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => {
  const full = join(process.cwd(), path)
  return existsSync(full) ? readFileSync(full, 'utf8') : ''
}

const charts = read('components/satisfaction/SatisfactionCharts.tsx')
const dashboard = read('components/satisfaction/SatisfactionDashboard.tsx')
const comments = read('components/satisfaction/SurveyComments.tsx')
const realtime = read('lib/hooks/useSurveyRealtime.ts')
const dashboardRoute = read('app/api/admin/satisfaction/dashboard/route.ts')
const commentsRoute = read('app/api/admin/satisfaction/comments/route.ts')
const commentRoute = read('app/api/admin/satisfaction/comments/[answerId]/route.ts')

for (const component of ['LineChart', 'BarChart']) assert.ok(charts.includes(component), `uses ${component}`)
assert.ok(charts.includes('layout="vertical"'), 'uses horizontal question bars')
assert.ok(charts.includes('stackId="likert"'), 'uses stacked Likert distribution')
assert.ok(charts.includes('<LabelList'), 'shows numeric labels')
assert.ok(charts.includes('<table'), 'provides tabular chart alternatives')
assert.ok(charts.includes('ResponsiveContainer'))

assert.ok(realtime.includes("table: 'survey_response_events'"))
assert.ok(realtime.includes('campaign_id=eq.'))
assert.ok(realtime.includes('onRefetch'))
assert.ok(!realtime.includes('survey_answers'))
assert.ok(dashboard.includes('useSurveyRealtime'))
assert.ok(dashboard.includes('/api/admin/satisfaction/dashboard'))

assert.ok(dashboardRoute.includes("requireResource('แบบสำรวจความพึงพอใจ', 'view')"))
assert.ok(commentsRoute.includes("requireResource('แบบสำรวจความพึงพอใจ', 'view')"))
assert.ok(commentRoute.includes("actor.role === 'Admin' || actor.role === 'Manager'"))
assert.ok(commentRoute.includes('comment_read_at'))
assert.ok(!commentRoute.includes('.delete()'))
assert.ok(!commentRoute.includes('text_value:'))
assert.ok(comments.includes("canManage = actorRole === 'Admin' || actorRole === 'Manager'"))
assert.ok(comments.includes('ดูและกรองความคิดเห็นเท่านั้น'))
assert.ok(comments.includes('aria-label'))
assert.ok(comments.includes('@media(max-width: 767px)'))
assert.ok(comments.includes('prefers-reduced-motion'))

console.log('satisfaction dashboard tests passed')
