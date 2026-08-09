import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const migrations = readdirSync(join(process.cwd(), 'supabase/migrations'))
const file = migrations.find(name => name.endsWith('_monthly_spill_nss_inspections.sql'))
assert.ok(file, 'monthly safety migration exists')
const sql = readFileSync(join(process.cwd(), 'supabase/migrations', file!), 'utf8')

for (const token of [
  'due_day_of_month',
  'lab_map_safety_form_templates',
  'lab_map_safety_form_template_items',
  'lab_map_safety_asset_assignments',
  'lab_map_safety_asset_supplies',
  'inspection_profile',
  'assignee_snapshot',
  'template_snapshot',
  "'biohazard_spill_kit'",
  "'chemical_spill_kit'",
  "'nss_eyewash'",
  "'CBH-ST-26'",
]) assert.ok(sql.includes(token), `migration contains ${token}`)

for (const table of [
  'lab_map_safety_form_templates',
  'lab_map_safety_form_template_items',
  'lab_map_safety_asset_assignments',
  'lab_map_safety_asset_supplies',
]) {
  assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'), `${table} enables RLS`)
  assert.match(sql, new RegExp(`REVOKE ALL ON public\\.${table}`, 'i'), `${table} is not exposed directly`)
}

assert.match(sql, /photo_r2_key\s+DROP NOT NULL/i, 'monthly profiles can submit without a photo')
assert.match(sql, /UPDATE public\.quality_task_schedules[\s\S]*due_day_of_month = 15[\s\S]*CBH-ST-04/i, 'spill task is due on day 15')
console.log('monthly safety schema contract passed')
