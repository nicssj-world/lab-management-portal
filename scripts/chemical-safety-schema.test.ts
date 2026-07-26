import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync('scripts/chemical-safety-module.sql', 'utf8')
const tables = [
  'chemical_units', 'chemical_rooms', 'chemical_storage_locations',
  'chemical_products', 'chemical_product_aliases', 'chemical_unit_products',
  'chemical_inventory_holdings', 'chemical_sds_files', 'chemical_sds_versions',
  'chemical_sds_hazards', 'chemical_role_scopes', 'chemical_change_requests',
  'chemical_import_batches', 'chemical_import_rows', 'chemical_qr_tokens',
]

for (const table of tables) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'), table)
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), table)
}
assert.match(sql, /revoke all[\s\S]+from anon, authenticated/i)
assert.match(sql, /grant select, insert, update, delete[\s\S]+to service_role/i)
assert.match(sql, /status[^;]+draft[^;]+in_review[^;]+approved[^;]+superseded[^;]+rejected/i)
assert.match(sql, /reviewed_by[^;]+<>[^;]+submitted_by/i, 'database blocks self approval')
assert.match(sql, /where status = 'approved'/i, 'one approved/current SDS is enforced with a partial index')
assert.match(sql, /security definer set search_path = ''/gi)
assert.match(sql, /insert into public\.audit_log/i, 'state transitions audit inside their transaction')
assert.match(sql, /chemical-prep/i)
for (const code of ['A1','A2','B1','B2','B3','B4','C1','C2','C3','C4','C5','T1','T2']) {
  assert.ok(sql.includes(`'${code}'`), `missing location ${code}`)
}
assert.match(sql, /on conflict/i, 'seed is idempotent')

console.log('chemical safety schema contract passed')
