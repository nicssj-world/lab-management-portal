import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const charts = readFileSync(resolve(process.cwd(), 'components/satisfaction/SatisfactionCharts.tsx'), 'utf8')
const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')
const chartCount = (charts.match(/<(?:LineChart|BarChart)\s/g) ?? []).length

assert.ok(charts.includes('function ChartTooltip'), 'uses a dedicated readable tooltip')
assert.equal((charts.match(/cursor=\{false\}/g) ?? []).length, chartCount, 'disables Recharts default gray hover cursor on every chart')
assert.equal((charts.match(/content=\{<ChartTooltip \/>\}/g) ?? []).length, chartCount, 'uses the calm tooltip on every chart')
assert.match(css, /\.satisfaction-chart-tooltip[^}]*background:\s*var\(--card\)/, 'tooltip keeps a card background')
assert.match(css, /\.satisfaction-chart-tooltip[^}]*box-shadow:/, 'tooltip has gentle elevation instead of a gray selection block')
assert.ok(charts.includes('fullName'), 'tooltip can show the full question name')

console.log('satisfaction chart polish tests passed')
