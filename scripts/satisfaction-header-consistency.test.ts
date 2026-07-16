import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const module = readFileSync(resolve(process.cwd(), 'components/satisfaction/SatisfactionModule.tsx'), 'utf8')

assert.ok(module.includes("import { PageHeader } from '@/components/ui/PageHeader'"), 'uses the shared module header')
assert.ok(module.includes('title="แบบสำรวจความพึงพอใจ"'), 'uses one clear module title')
assert.equal((module.match(/setCreateSurveyOpen\(true\)/g) ?? []).length, 1, 'provides one create-survey entry point')
assert.ok(!module.includes('satisfaction-hero'), 'does not retain the separate decorative hero')
assert.ok(!module.includes('satisfaction-hero-metrics'), 'does not duplicate dashboard metrics in the header')
assert.ok(module.includes('satisfaction-summary-card'), 'keeps KPI information in the dashboard content')

console.log('satisfaction header consistency tests passed')
