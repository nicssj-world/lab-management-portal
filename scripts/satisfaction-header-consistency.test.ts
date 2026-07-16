import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const module = readFileSync(resolve(process.cwd(), 'components/satisfaction/SatisfactionModule.tsx'), 'utf8')

assert.ok(module.includes("import { PageHeader } from '@/components/ui/PageHeader'"), 'uses the shared module header')
assert.ok(module.includes("eyebrow=\"SATISFACTION SURVEY\""), 'uses the same eyebrow hierarchy as the analytics modules')
assert.ok(module.includes('title="แบบสำรวจความพึงพอใจ"'), 'uses one clear module title')
assert.ok(module.includes("style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}"), 'uses the same stacked page rhythm as the analytics modules')
assert.ok(module.includes('marginBottom={0}'), 'lets the shared page wrapper control vertical spacing')
assert.ok(!module.includes('margin-bottom:20px'), 'does not stack a separate tab margin on top of the page rhythm')
assert.equal((module.match(/setCreateSurveyOpen\(true\)/g) ?? []).length, 1, 'provides one create-survey entry point')
assert.ok(!module.includes('satisfaction-hero'), 'does not retain the separate decorative hero')
assert.ok(!module.includes('satisfaction-hero-metrics'), 'does not duplicate dashboard metrics in the header')
assert.ok(module.includes('satisfaction-summary-card'), 'keeps KPI information in the dashboard content')

console.log('satisfaction header consistency tests passed')
