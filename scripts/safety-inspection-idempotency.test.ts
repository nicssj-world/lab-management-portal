import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationPath = join(root, 'supabase', 'migrations', '20260819110000_prevent_duplicate_safety_inspections.sql')
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : ''
const route = readFileSync(join(root, 'app', 'api', 'admin', 'lab-map', 'safety-assets', '[id]', 'inspection-photo', 'route.ts'), 'utf8')
const server = readFileSync(join(root, 'lib', 'quality-tasks', 'safety-server.ts'), 'utf8')
const assetServer = readFileSync(join(root, 'lib', 'lab-map', 'safety-server.ts'), 'utf8')
const historyRoute = readFileSync(join(root, 'app', 'api', 'admin', 'lab-map', 'safety-assets', '[id]', 'inspections', 'route.ts'), 'utf8')
const mobile = readFileSync(join(root, 'components', 'lab-map', 'SafetyInspectionMobile.tsx'), 'utf8')

assert.ok(migration, 'duplicate-inspection migration must exist')
assert.match(migration, /ADD COLUMN IF NOT EXISTS superseded_at timestamptz/, 'inspections need a reversible superseded marker')
assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS[\s\S]*asset_date_photo[\s\S]*\(asset_id, inspected_on\)/, 'one active photo inspection per asset/date must be enforced')
assert.match(migration, /existing_id/, 'the inspection RPC must reuse an existing same-day inspection')
assert.match(migration, /superseded_at IS NULL/, 'uniqueness and deduplication must ignore only archived duplicates')
assert.match(route, /reused/, 'the API must report when an inspection was reused')
assert.match(route, /deleteSafetyPhoto\(parsed\.data\.key\)/, 'a reused inspection must remove the newly uploaded duplicate photo')
assert.match(server, /\.is\('superseded_at', null\)/, 'annual evidence must hide superseded inspections')
assert.match(assetServer, /\.is\('superseded_at', null\)/, 'asset status must ignore superseded inspections')
assert.match(historyRoute, /\.is\('superseded_at', null\)/, 'inspection history must hide superseded inspections')
assert.match(mobile, /submissionLockRef/, 'mobile submit must have an immediate double-submit lock')
assert.match(mobile, /saved\.reused/, 'mobile UI must tell the operator when the existing inspection was reused')

console.log('scripts/safety-inspection-idempotency.test.ts: all assertions passed')
