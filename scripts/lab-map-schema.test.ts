import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync('scripts/lab-map-module.sql', 'utf8')
for (const table of [
  'lab_map_spaces', 'lab_map_zones', 'lab_map_zone_spaces',
  'lab_map_space_work_units', 'lab_map_access_points', 'lab_map_stations',
  'lab_map_versions', 'lab_map_person_assignments',
]) assert.match(sql, new RegExp(`create table if not exists ${table}`, 'i'))

assert.match(sql, /num_nonnulls\(space_id, zone_id\) = 1/i)
assert.match(sql, /enable row level security/gi)
assert.match(sql, /unique[\s\S]*code|code text not null unique/i)
assert.match(sql, /references profiles\(id\)/i)
assert.match(sql, /on conflict \(code\) do update/gi)
assert.doesNotMatch(sql, /alter table\s+(?:public\.)?equipment/i)
assert.doesNotMatch(sql, /equipment_map|lab_map_equipment/i)
for (const column of ['version_code', 'manifest_hash', 'effective_date', 'reviewed_by', 'approved_by', 'approved_at']) {
  assert.match(sql, new RegExp(column, 'i'))
}
assert.match(sql, /status IN \('draft', 'published', 'retired'\)/i)
assert.match(sql, /lab_map_one_published_version_idx/i)
console.log('lab map schema contract passed')
