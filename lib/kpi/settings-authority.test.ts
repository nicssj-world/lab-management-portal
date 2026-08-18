import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const correctionSql = readFileSync(join(root, 'scripts', 'kpi-target-correction.sql'), 'utf8')
const seedSql = [
  readFileSync(join(root, 'scripts', 'kpi-mockup-seed.sql'), 'utf8'),
  readFileSync(join(root, 'scripts', 'kpi-seed-2568.sql'), 'utf8'),
]

assert.doesNotMatch(
  correctionSql,
  /update\s+kpi_definitions\s+set\s+target_type\s*=\s*'gte'/i,
  'the correction SQL must not overwrite target operators configured in Settings',
)

for (const sql of seedSql) {
  const definitionUpsert = sql.match(/insert\s+into\s+kpi_definitions[\s\S]*?on\s+conflict[\s\S]*?;/i)?.[0]
  assert.ok(definitionUpsert, 'seed must contain an idempotent KPI definition insert')
  assert.doesNotMatch(
    definitionUpsert,
    /on\s+conflict\s*\(code\)\s*do\s+update/i,
    'seed upserts must not overwrite KPI definitions configured in Settings',
  )
}

console.log('KPI Settings authority tests passed')
