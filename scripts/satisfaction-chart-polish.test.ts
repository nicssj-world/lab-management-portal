import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const charts = readFileSync(resolve(process.cwd(), 'components/satisfaction/SatisfactionCharts.tsx'), 'utf8')

assert.ok(charts.includes('function ChartTooltip'), 'uses a dedicated readable tooltip')
assert.equal((charts.match(/cursor=\{false\}/g) ?? []).length, 3, 'disables Recharts default gray hover cursor on every chart')
assert.equal((charts.match(/content=\{<ChartTooltip \/>\}/g) ?? []).length, 3, 'uses the calm tooltip on every chart')
assert.ok(charts.includes("background: 'var(--card)'"), 'tooltip keeps a white card background')
assert.ok(charts.includes('boxShadow:'), 'tooltip has gentle elevation instead of a gray selection block')
assert.ok(charts.includes('fullName'), 'tooltip can show the full question name')

console.log('satisfaction chart polish tests passed')
