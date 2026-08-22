import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const panel = read('components/kpi/KpiSatisfactionPanel.tsx')
const page = read('app/(protected)/kpi/dashboard/page.tsx')
const css = read('app/globals.css')
const dialog = read('components/satisfaction/SatisfactionDialog.tsx')

assert.match(panel, /kpi-satisfaction-dashboard/, 'uses a dedicated satisfaction KPI dashboard shell')
assert.match(panel, /ปีงบประมาณ/, 'provides a fiscal-year filter')
assert.match(panel, /แหล่งข้อมูล/, 'provides a source filter')
assert.match(panel, /สถานะ/, 'provides a status filter')
assert.match(panel, /ผ่านเป้าหมาย/, 'shows the pass summary')
assert.match(panel, /ต่ำกว่าเป้าหมาย/, 'shows the below-target summary')
assert.match(panel, /ยังไม่มีผล/, 'shows the missing-result summary')
assert.match(panel, /รอเผยแพร่/, 'shows pending survey publication')
assert.match(panel, /kpi-satisfaction-bullet/, 'uses compact target comparison bars')
assert.match(panel, /value\s*>?=\s*metric\.target|current\.value\s*>?=\s*metric\.target/, 'pass logic uses greater-than-or-equal target')
assert.match(panel, /แนวโน้มข้ามปี/, 'shows a history trend section')
assert.match(panel, /เปลี่ยนจากปีก่อน/, 'trend fallback reports year-over-year change')
assert.match(panel, /ตารางแนวโน้ม KPI ความพึงพอใจข้ามปี/, 'trend chart has an accessible data table')
assert.match(panel, /ประวัติรายปี/, 'keeps an accessible history view')
assert.match(panel, /จากแบบสำรวจ/, 'labels survey-origin values')
assert.match(panel, /เผยแพร่โดย/, 'shows survey publication provenance')
assert.match(panel, /canViewCampaign/, 'only exposes campaign links when Satisfaction access allows it')
assert.match(panel, /กรอกด้วยตนเอง/, 'labels manual values')
assert.match(panel, /aria-live="polite"/, 'announces asynchronous status')
assert.match(panel + dialog, /role="dialog"/, 'management dialogs expose dialog semantics')
assert.match(panel + dialog, /aria-modal="true"/, 'management dialogs are modal to assistive technology')
assert.doesNotMatch(panel, /<td[\s\S]{0,180}onClick=/, 'history cells are not hidden click-to-edit controls')
assert.doesNotMatch(panel, /\+ ปีงบประมาณ/, 'does not create empty fiscal-year columns')

assert.match(page, /จัดการชุดตัวชี้วัด/, 'uses an explicit metric-management action')
assert.match(page, /เพิ่มค่าจากแหล่งอื่น/, 'uses an explicit manual-value action')
assert.match(page, /metricCode/, 'supports metric deep links')
assert.match(page, /fiscalYear/, 'supports fiscal-year deep links')

assert.match(css, /\.kpi-satisfaction-dashboard/, 'ships scoped KPI satisfaction styles')
assert.match(css, /\.kpi-satisfaction-summary-grid/, 'styles the KPI summary grid')
assert.match(css, /\.kpi-satisfaction-mobile-history/, 'provides a mobile history presentation')
assert.match(css, /@media \(max-width: 767px\)[\s\S]*kpi-satisfaction/, 'adapts the KPI dashboard for mobile')
assert.match(css, /prefers-reduced-motion[\s\S]*kpi-satisfaction/, 'respects reduced motion')

console.log('KPI satisfaction dashboard redesign contract tests passed')
