import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboard = readFileSync('components/kpi/KpiPresentationDashboard.tsx', 'utf8')
const uncrossCard = dashboard.match(/function UncrossCard[\s\S]*?(?=\/\/ ── Zero-incident)/)?.[0] ?? ''

assert.match(uncrossCard, /<Tooltip[^>]*cursor=\{false\}/, 'Uncrossmatch tooltip must not paint the default grey hover cursor behind a bar')

console.log('kpi chart tooltip tests passed')
