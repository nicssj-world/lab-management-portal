import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(join(process.cwd(), 'scripts/quality-task-action-items.sql'), 'utf8')

assert.ok(sql.includes('create table if not exists public.quality_task_action_items'), 'creates quality_task_action_items')
assert.ok(sql.includes('references public.quality_task_instances(id) on delete cascade'), 'cascades with the parent instance')
assert.ok(sql.includes("check (user_id is not null or (manual_name is not null and trim(manual_name) <> ''))"), 'requires a linked user or a manual name')
assert.ok(sql.includes('check ((done_at is null) = (done_by is null))'), 'keeps done_at/done_by in sync')
assert.ok(sql.includes('alter table public.quality_task_action_items enable row level security'), 'enables RLS with no policy, matching the rest of the module')

console.log('scripts/quality-task-action-items.test.ts: all assertions passed')
