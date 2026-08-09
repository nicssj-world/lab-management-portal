import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync('scripts/lab-map-safety-module.sql', 'utf8')
const pointTypeMigration = readFileSync('supabase/migrations/20260809075130_lab_map_safety_point_types.sql', 'utf8')

for (const table of [
  'lab_map_safety_assets', 'lab_map_safety_inspections', 'lab_map_safety_editors',
  'lab_map_safety_inspection_rounds', 'lab_map_safety_inspection_round_items',
  'lab_map_assembly_points', 'lab_map_assembly_point_exits', 'lab_map_assembly_point_verifications',
]) assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'))

for (const kind of [
  'fire-extinguisher', 'fire-hose', 'manual-call-point', 'aed', 'first-aid-kit',
  'eyewash', 'emergency-shower', 'spill-kit', 'emergency-shutoff',
]) assert.ok(sql.includes(`'${kind}'`), `schema supports ${kind}`)

assert.match(sql, /asset_snapshot\s+jsonb/i)
assert.match(sql, /assembly_point_snapshot\s+jsonb/i)
assert.match(sql, /point_type\s+text\s+not null/i)
assert.match(sql, /point_type[^;]+assembly[^;]+safe/i)
assert.match(pointTypeMigration, /add column if not exists point_type/i)
assert.match(pointTypeMigration, /assembly_point_type_check/i)
assert.match(sql, /position_status[^;]+unverified[^;]+verified/i)
assert.match(sql, /latitude[\s\S]+between -90 and 90/i)
assert.match(sql, /longitude[\s\S]+between -180 and 180/i)
assert.match(sql, /enable row level security/gi)
assert.match(sql, /revoke all[\s\S]+from anon, authenticated/i)
assert.match(sql, /grant select, insert, update, delete[\s\S]+to service_role/i)
assert.match(sql, /security definer set search_path = ''/i)
assert.match(sql, /extinguisher-11/i)
assert.match(sql, /assembly-front-admin-building/i)
assert.match(sql, /exit-3a/i)
assert.match(sql, /on conflict/i, 'seed must be idempotent')
assert.match(sql, /checklist_snapshot jsonb not null default '\[\]'::jsonb/i)
assert.match(sql, /unique\s*\(round_id, asset_id\)/i)
assert.match(sql, /status text not null[^;]+open[^;]+closed/i)

console.log('lab map safety schema contract passed')
