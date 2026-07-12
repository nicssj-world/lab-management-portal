import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(join(process.cwd(), 'scripts/quality-task-module.sql'), 'utf8')

for (const table of [
  'quality_task_templates', 'quality_task_schedules', 'quality_task_default_assignees',
  'quality_task_instances', 'quality_task_instance_assignees', 'quality_task_attachments',
]) assert.ok(sql.includes(`create table if not exists public.${table}`), `creates ${table}`)

assert.ok(sql.includes('unique (schedule_id, period_start)'), 'prevents duplicate scheduled occurrences')
assert.ok(sql.includes("'งานคุณภาพ:edit'"), 'seeds edit permission')
assert.ok(sql.includes("'งานคุณภาพ:view'"), 'seeds view permission')

const sourceKeys = [...sql.matchAll(/'CBH-QT-(\d{2})'/g)].map(m => m[1])
assert.deepEqual([...new Set(sourceKeys)], Array.from({ length: 44 }, (_, i) => String(i + 1).padStart(2, '0')))
for (const code of 'ABCDEFGHI') assert.ok(sql.includes(`'${code}',`), `includes category ${code}`)

assert.ok(sql.includes("'CBH-QT-39', 'monthly'"), 'monthly meeting schedules are seeded')
assert.ok(sql.includes("'CBH-QT-44', 'monthly'"), 'all six committee/staff meetings are monthly')
assert.ok(sql.includes("task_kind = 'meeting'"), 'meeting evidence rule is explicit')

console.log('scripts/quality-task-module.test.ts: all assertions passed')
