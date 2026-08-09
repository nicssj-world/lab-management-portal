import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const migrationName = readdirSync(join(process.cwd(), 'supabase/migrations'))
  .find(name => name.includes('safety_task_evidence') && name.endsWith('.sql'))
assert.ok(migrationName, 'safety task migration exists')
const sql = read(`supabase/migrations/${migrationName}`)
const types = read('lib/quality-tasks/types.ts')
const server = read('lib/quality-tasks/server.ts')

for (const contract of [
  "workstream text not null default 'quality'",
  "recurrence_mode text not null default 'fixed_calendar'",
  'quality_task_evidence_requirements',
  'quality_task_reviews',
  'quality_task_links',
  'safety_certificates',
  'safety_certificate_versions',
]) assert.ok(sql.toLowerCase().includes(contract), `migration includes ${contract}`)

assert.match(sql, /enable row level security/gi, 'new public tables enable RLS')
assert.match(sql, /revoke all[\s\S]+from anon, authenticated/gi, 'browser roles have no direct access')
assert.ok(sql.includes("'CBH-ST-"), 'migration seeds safety master tasks')
assert.ok(sql.includes("'CBH-QT-29'") && sql.includes("'CBH-QT-42'"), 'legacy F29-F33 and I42 are preserved as inactive safety history')
assert.match(sql, /unique \(certificate_id, expires_on\)/i, 'certificate renewal is unique by certificate and expiry date')
assert.match(sql, /safety_certificate_versions[\s\S]+certificate_type text not null[\s\S]+expires_on date/i, 'certificate versions retain historical metadata with the file')
assert.match(sql, /quality_task_action_items_source_unique/i, 'inspection-derived CAPA has an idempotent source identity')

assert.ok(types.includes("export type TaskWorkstream = 'quality' | 'safety'"), 'types expose task workstream')
assert.ok(types.includes("export type RecurrenceMode = 'fixed_calendar' | 'rolling_completion'"), 'types expose recurrence mode')
assert.ok(types.includes("export type TaskStatus = 'open' | 'in_progress' | 'pending_review' | 'completed'"), 'types expose safety workflow states')
assert.ok(types.includes("export type ApprovalMode = 'none' | 'required'"), 'types expose approval mode')
assert.ok(types.includes("export type IntegrationKind = 'none' | 'safety_inspection' | 'equipment_reference'"), 'types expose integrations')
assert.ok(types.includes("export type TaskIntervalUnit = 'day' | 'week' | 'month' | 'year'"), 'types support day intervals')

assert.ok(server.includes("workstream: TaskWorkstream = 'quality'"), 'shared server defaults to quality workstream')
assert.ok(server.includes(".eq('workstream', workstream)"), 'shared queries filter workstream server-side')
assert.ok(server.includes('getTaskEvidenceRequirements'), 'server loads evidence requirement checklists')
assert.ok(server.includes('materializeCertificateRenewals'), 'server materializes certificate renewal tasks idempotently')

console.log('scripts/safety-task-module.test.ts: all assertions passed')
