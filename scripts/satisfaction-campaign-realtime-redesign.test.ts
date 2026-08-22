import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const campaign = read('components/satisfaction/CampaignManager.tsx')
const dashboard = read('components/satisfaction/SatisfactionDashboard.tsx')
const charts = read('components/satisfaction/SatisfactionCharts.tsx')
const realtime = read('lib/hooks/useSurveyRealtime.ts')
const exportsUi = read('components/satisfaction/SatisfactionExportActions.tsx')
const primitives = read('components/satisfaction/SatisfactionPrimitives.tsx')
const css = read('app/globals.css')

assert.doesNotMatch(campaign, /ชื่อรอบ\s*<input/, 'campaign names are generated, not typed')
assert.match(campaign, /ปีงบประมาณ/, 'campaign creation selects a fiscal year')
assert.match(campaign, /หน่วยงาน/, 'campaign creation selects a department')
assert.match(campaign, /ชุด KPI/, 'campaign creation selects a KPI metric')
assert.match(campaign, /เป้าหมายจำนวนคำตอบ/, 'campaign creation captures a non-blocking response target')
assert.match(campaign, /ชื่อรอบจะสร้างอัตโนมัติ/, 'campaign form explains generated names')
assert.match(campaign, /ต้องกำหนด KPI/, 'legacy campaigns expose the one-time KPI requirement')
assert.match(campaign, /metricCode=.*fiscalYear=/, 'campaign card deep-links to KPI history')
assert.match(primitives, /รอเปิด/, 'scheduled campaigns have a human-readable status')
assert.match(primitives, /หมดเวลารอปิดรอบ/, 'expired campaigns have a human-readable status')

assert.match(dashboard, /ปีงบประมาณ/, 'realtime dashboard filters by fiscal year')
assert.match(dashboard, /แบบสำรวจ/, 'realtime dashboard filters by survey')
assert.match(dashboard, /หน่วยงาน/, 'realtime dashboard filters by department')
assert.match(dashboard, /60000|60_000/, 'realtime dashboard has a 60 second polling fallback')
assert.match(dashboard, /requestSequence|requestId/, 'stale requests cannot overwrite a newly selected campaign')
assert.match(dashboard, /background/, 'realtime refetch supports a background state')
assert.match(dashboard + realtime, /SUBSCRIBED|เชื่อมต่อ/, 'realtime connection status is visible')
assert.match(dashboard, /คำตอบล่าสุด/, 'last response time is distinct from refresh time')
assert.match(dashboard, /ข้อมูลยังน้อย/, 'small sample results are clearly labelled')
assert.match(dashboard, /KPI ของรอบนี้/, 'campaign KPI context is shown in the survey module')
assert.match(charts, /คะแนนแยกหมวด/, 'dashboard shows section scores')
assert.match(charts, /ต่ำไปสูง/, 'question scores prioritize weak points')
assert.match(charts, /Likert|ระดับคะแนนรายคำถาม/, 'question-level Likert distributions are present')
assert.doesNotMatch(charts, /type="monotone"/, 'trend line does not imply unobserved smoothed values')
assert.match(charts, /จำนวนคำตอบ/, 'charts consistently use response-count language')

assert.doesNotMatch(exportsUi, /setFiscalYear|type="number"[^>]*ปีงบ/, 'report year is derived from the selected campaign')
assert.doesNotMatch(exportsUi, /metricCode|metricName/, 'KPI publication metadata is derived from the campaign')

assert.match(css, /\.satisfaction-realtime-toolbar/, 'ships scoped realtime dashboard styles')
assert.match(css, /@media \(max-width: 767px\)[\s\S]*satisfaction-realtime/, 'realtime dashboard adapts to mobile')

console.log('Satisfaction campaign and realtime redesign contract tests passed')
