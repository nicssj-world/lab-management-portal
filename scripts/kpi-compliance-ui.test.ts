import assert from 'node:assert/strict'
import fs from 'node:fs'

const dashboard = fs.readFileSync('app/(protected)/kpi/dashboard/page.tsx', 'utf8')
const monitor = fs.readFileSync('components/kpi/KpiComplianceMonitor.tsx', 'utf8')
const exportButton = fs.readFileSync('components/kpi/KpiExportButton.tsx', 'utf8')

assert.match(dashboard, /ติดตามการส่ง/)
assert.match(dashboard, /KpiComplianceMonitor/)
assert.match(dashboard, /id: 'compliance'/)
assert.match(monitor, /aria-label=\{`\$\{period\.dept_name\}/)
assert.match(monitor, /role="dialog"/)
assert.match(monitor, /prefers-reduced-motion:reduce/)
assert.match(monitor, /\/kpi\/api\/compliance\/detail/)
assert.match(monitor, /รายการขาด/)
assert.match(exportButton, /'สถานะการส่ง'/)
assert.match(exportButton, /'รายการขาด'/)
assert.ok(fs.existsSync('app/(protected)/kpi/api/compliance/route.ts'))
assert.ok(fs.existsSync('app/(protected)/kpi/api/compliance/detail/route.ts'))

console.log('KPI compliance UI contract tests passed')
