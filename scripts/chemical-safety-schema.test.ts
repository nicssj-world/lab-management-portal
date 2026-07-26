import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync('scripts/chemical-safety-module.sql', 'utf8')
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts?: Record<string, string>
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function functionDefinition(name: string) {
  const start = sql.search(new RegExp(`create or replace function public\\.${name}\\s*\\(`, 'i'))
  assert.notEqual(start, -1, `missing function ${name}`)
  const end = sql.indexOf('$$;', start)
  assert.notEqual(end, -1, `unterminated function ${name}`)
  return sql.slice(start, end + 3)
}

function tableDefinition(name: string) {
  const start = sql.search(new RegExp(`create table if not exists public\\.${name}\\s*\\(`, 'i'))
  assert.notEqual(start, -1, `missing table ${name}`)
  const end = sql.indexOf('\n);', start)
  assert.notEqual(end, -1, `unterminated table ${name}`)
  return sql.slice(start, end + 3)
}

function constraintDefinition(tableSql: string, name: string) {
  const start = tableSql.search(new RegExp(`constraint ${name} check \\(`, 'i'))
  assert.notEqual(start, -1, `missing constraint ${name}`)
  const open = tableSql.indexOf('(', start)
  let depth = 0
  for (let index = open; index < tableSql.length; index += 1) {
    if (tableSql[index] === '(') depth += 1
    if (tableSql[index] === ')') depth -= 1
    if (depth === 0) return tableSql.slice(start, index + 1)
  }
  assert.fail(`unterminated constraint ${name}`)
}

const normalized = sql.trim()
assert.match(normalized, /^--[\s\S]*\bBEGIN;/i, 'migration starts a transaction')
assert.match(normalized, /NOTIFY pgrst, 'reload schema';\s*COMMIT;$/i, 'migration commits after schema reload')
assert.equal(
  packageJson.scripts?.['test:chemical-safety'],
  'tsx scripts/chemical-safety-schema.test.ts && tsx lib/chemical-safety/domain.test.ts && tsx lib/chemical-safety/import/masterlist-june-2026.test.ts && tsx lib/chemical-safety/import/sds-import.test.ts',
  'Chemical safety package script runs the schema, domain, master-list, and SDS import contracts',
)

const tables = [
  'chemical_units', 'chemical_rooms', 'chemical_storage_locations',
  'chemical_products', 'chemical_product_aliases', 'chemical_unit_products',
  'chemical_inventory_holdings', 'chemical_sds_files', 'chemical_sds_versions',
  'chemical_sds_hazards', 'chemical_role_scopes', 'chemical_change_requests',
  'chemical_import_batches', 'chemical_import_rows', 'chemical_qr_tokens',
]

const createdTables = [...sql.matchAll(/create table(?: if not exists)? public\.([a-z0-9_]+)\s*\(/gi)]
  .map(match => match[1])
assert.deepEqual(createdTables, tables, 'migration creates exactly the 15 required application tables')
assert.equal(new Set(createdTables).size, 15, 'application table names are unique')

for (const table of tables) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'), table)
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), table)
}

const revokedTableNames = [...sql.matchAll(/revoke all on\s+(public\.[\s\S]*?)\s+from anon, authenticated;/gi)]
  .flatMap(statement => [...statement[1].matchAll(/public\.([a-z0-9_]+)/gi)].map(match => match[1]))
const grantedTableNames = [...sql.matchAll(/grant select, insert, update, delete on\s+(public\.[\s\S]*?)\s+to service_role;/gi)]
  .flatMap(statement => [...statement[1].matchAll(/public\.([a-z0-9_]+)/gi)].map(match => match[1]))
assert.deepEqual(revokedTableNames, tables, 'anon/authenticated revokes cover exactly every application table')
assert.deepEqual(grantedTableNames, tables, 'service-role CRUD grants cover exactly every application table')
for (const table of tables) {
  assert.equal(revokedTableNames.filter(name => name === table).length, 1, `${table} has one explicit revoke`)
  assert.equal(grantedTableNames.filter(name => name === table).length, 1, `${table} has one explicit service-role grant`)
}
assert.match(sql, /status[^;]+draft[^;]+in_review[^;]+approved[^;]+superseded[^;]+rejected/i)
const sdsTable = tableDefinition('chemical_sds_versions')
const changeTable = tableDefinition('chemical_change_requests')
assert.match(sdsTable, /constraint chemical_sds_no_self_review[\s\S]*?reviewed_by\s*<>\s*submitted_by/i)
assert.match(changeTable, /constraint chemical_change_no_self_review[\s\S]*?reviewed_by\s*<>\s*submitted_by/i)
const sdsWorkflow = constraintDefinition(sdsTable, 'chemical_sds_workflow_coherent')
const changeWorkflow = constraintDefinition(changeTable, 'chemical_change_workflow_coherent')
assert.match(
  sdsWorkflow,
  /constraint chemical_sds_workflow_coherent[\s\S]*?status\s*=\s*'in_review'[\s\S]*?submitted_by is not null[\s\S]*?submitted_at is not null[\s\S]*?status in \('approved','superseded','rejected'\)[\s\S]*?reviewed_by is not null[\s\S]*?reviewed_at is not null/i,
  'SDS workflow rows require coherent submit/review actors and timestamps',
)
assert.match(
  sdsWorkflow,
  /status\s*=\s*'draft'[\s\S]*?submitted_by is null[\s\S]*?submitted_at is null[\s\S]*?reviewed_by is null[\s\S]*?reviewed_at is null/i,
  'SDS drafts cannot carry submit/review state',
)
assert.match(
  sdsWorkflow,
  /status in \('approved','superseded','rejected'\)[\s\S]*?submitted_by is not null[\s\S]*?submitted_at is not null[\s\S]*?reviewed_by is not null[\s\S]*?reviewed_at is not null/i,
  'reviewed SDS rows retain complete submit and review state',
)
assert.match(sdsWorkflow, /status <> 'rejected' or nullif\(btrim\(review_reason\), ''\) is not null/i)
assert.match(
  changeWorkflow,
  /constraint chemical_change_workflow_coherent[\s\S]*?status\s*=\s*'in_review'[\s\S]*?submitted_by is not null[\s\S]*?submitted_at is not null[\s\S]*?status in \('approved','rejected'\)[\s\S]*?reviewed_by is not null[\s\S]*?reviewed_at is not null/i,
  'change-request rows require coherent submit/review actors and timestamps',
)
assert.match(
  changeWorkflow,
  /status\s*=\s*'draft'[\s\S]*?submitted_by is null[\s\S]*?submitted_at is null[\s\S]*?reviewed_by is null[\s\S]*?reviewed_at is null/i,
  'change-request drafts cannot carry submit/review state',
)
assert.match(
  changeWorkflow,
  /status in \('approved','rejected'\)[\s\S]*?submitted_by is not null[\s\S]*?submitted_at is not null[\s\S]*?reviewed_by is not null[\s\S]*?reviewed_at is not null/i,
  'reviewed change requests retain complete submit and review state',
)
assert.match(changeWorkflow, /status <> 'rejected' or nullif\(btrim\(review_reason\), ''\) is not null/i)
assert.match(
  sql,
  /create unique index if not exists uq_chemical_sds_one_approved_per_product\s+on public\.chemical_sds_versions\(product_id\) where status = 'approved'/i,
  'one approved/current SDS is enforced with the named partial index',
)

const rpcSignatures: Record<string, string> = {
  submit_chemical_change_request: 'uuid,uuid',
  review_chemical_change_request: 'uuid,uuid,text,text',
  update_chemical_sds_draft: 'uuid,uuid,timestamptz,jsonb,jsonb',
  submit_chemical_sds_version: 'uuid,uuid',
  review_chemical_sds_version: 'uuid,uuid,text,text',
}

const rpcDeclarations: Record<string, RegExp> = {
  submit_chemical_change_request: /\(\s*p_request_id uuid, p_actor_id uuid\s*\) returns uuid/i,
  review_chemical_change_request: /\(\s*p_request_id uuid, p_actor_id uuid, p_decision text, p_reason text\s*\) returns uuid/i,
  update_chemical_sds_draft: /\(\s*p_version_id uuid, p_actor_id uuid, p_expected_updated_at timestamptz,\s*p_metadata jsonb, p_hazards jsonb\s*\) returns uuid/i,
  submit_chemical_sds_version: /\(\s*p_version_id uuid, p_actor_id uuid\s*\) returns uuid/i,
  review_chemical_sds_version: /\(\s*p_version_id uuid, p_actor_id uuid, p_decision text, p_reason text\s*\) returns uuid/i,
}

const createdFunctionNames = [...sql.matchAll(/create or replace function public\.([a-z0-9_]+)\s*\(/gi)]
  .map(match => match[1])
const infrastructureFunctionNames = new Set([
  'chemical_sds_statements_valid',
  'guard_chemical_import_batch_provenance',
  'guard_chemical_import_row_provenance',
])
const applicationRpcNames = createdFunctionNames.filter(name => !infrastructureFunctionNames.has(name))
assert.deepEqual(
  applicationRpcNames,
  Object.keys(rpcSignatures),
  'migration creates exactly the five required application RPCs',
)
assert.equal(applicationRpcNames.length, 5, 'application RPC count')
assert.equal(createdFunctionNames.length, 8, 'only the five RPCs and three named infrastructure functions exist')

for (const [name, signature] of Object.entries(rpcSignatures)) {
  const definition = functionDefinition(name)
  assert.match(definition, rpcDeclarations[name], `${name} declaration signature`)
  assert.match(definition, /language plpgsql security definer set search_path = ''/i, `${name} search path`)
  assert.match(
    definition,
    /if p_actor_id is null then raise exception 'actor_required'; end if;/i,
    `${name} rejects a null actor up front`,
  )
  const escapedCall = `${escapeRegExp(name)}\\(${escapeRegExp(signature)}\\)`
  assert.match(
    sql,
    new RegExp(`revoke all on function public\\.${escapedCall}\\s+from PUBLIC, anon, authenticated`, 'i'),
    `${name} revoke`,
  )
  assert.match(
    sql,
    new RegExp(`grant execute on function public\\.${escapedCall}\\s+to service_role`, 'i'),
    `${name} service-role grant`,
  )
}

const submitChange = functionDefinition('submit_chemical_change_request')
assert.match(submitChange, /where id = p_request_id\s+for update/i)
assert.match(submitChange, /current_row\.status\s*<>\s*'draft'/i)
assert.match(
  submitChange,
  /update public\.chemical_change_requests[\s\S]*?set status = 'in_review', submitted_by = p_actor_id, submitted_at = now\(\)[\s\S]*?where id = p_request_id/i,
  'change submit records actor and timestamp',
)
assert.match(
  submitChange,
  /insert into public\.audit_log\(action, user_id, target, detail\)[\s\S]*?'chemical_safety\.change_request\.submit'[\s\S]*?'before', current_row\.status, 'after', 'in_review'/i,
  'change submit writes its action-specific audit',
)

const reviewChange = functionDefinition('review_chemical_change_request')
assert.match(reviewChange, /where id = p_request_id\s+for update/i)
assert.match(reviewChange, /current_row\.status\s*<>\s*'in_review'/i)
assert.match(reviewChange, /current_row\.submitted_by\s*=\s*p_actor_id/i)
assert.match(reviewChange, /p_decision is null or p_decision not in \('approved','rejected'\)/i)
assert.match(
  reviewChange,
  /p_decision = 'rejected'[\s\S]*?nullif\(btrim\(p_reason\), ''\) is null[\s\S]*?raise exception 'rejection_reason_required'/i,
)
assert.match(reviewChange, /select to_jsonb\(product\)[\s\S]*?into target_before[\s\S]*?for update/i)
assert.match(reviewChange, /update public\.chemical_products as product[\s\S]*?returning to_jsonb\(product\) into target_after/i)
assert.match(reviewChange, /select to_jsonb\(holding\)[\s\S]*?into target_before[\s\S]*?for update/i)
assert.match(reviewChange, /update public\.chemical_inventory_holdings as holding[\s\S]*?returning to_jsonb\(holding\) into target_after/i)
assert.match(reviewChange, /'target_before', target_before[\s\S]*?'target_after', target_after/i)

const updateDraft = functionDefinition('update_chemical_sds_draft')
assert.match(updateDraft, /current_row\.status\s*<>\s*'draft'/i)
assert.match(
  updateDraft,
  /current_row\.created_by is not null[\s\S]*?current_row\.created_by = p_actor_id[\s\S]*?current_row\.submitted_by is not null[\s\S]*?current_row\.submitted_by = p_actor_id/i,
  'draft ownership requires a non-null matching owner',
)
assert.match(updateDraft, /current_row\.updated_at is distinct from p_expected_updated_at[\s\S]*?stale_sds_draft/i)
assert.match(updateDraft, /delete from public\.chemical_sds_hazards/i)
assert.match(updateDraft, /'before', before_detail, 'after', after_detail/i)

const statementValidator = functionDefinition('chemical_sds_statements_valid')
assert.match(statementValidator, /jsonb_typeof\(statement->'code'\)\s*<>\s*'string'/i, 'reusable validator rejects null/non-string codes')
assert.match(statementValidator, /jsonb_typeof\(statement->'text'\)\s*<>\s*'string'/i, 'reusable validator rejects null/non-string text')
assert.match(sdsTable, /chemical_sds_statements_valid\(h_statements, 'H'\)/i)
assert.match(sdsTable, /chemical_sds_statements_valid\(p_statements, 'P'\)/i)

const hValidation = updateDraft.match(/if p_metadata \? 'h_statements' and exists \(([\s\S]*?)\) then raise exception 'invalid_h_statements'/i)?.[1]
const pValidation = updateDraft.match(/if p_metadata \? 'p_statements' and exists \(([\s\S]*?)\) then raise exception 'invalid_p_statements'/i)?.[1]
assert.ok(hValidation, 'H statement RPC validation exists')
assert.ok(pValidation, 'P statement RPC validation exists')
for (const [kind, validation] of [['H', hValidation], ['P', pValidation]] as const) {
  assert.match(validation, /jsonb_typeof\(statement->'code'\)\s*<>\s*'string'/i, `${kind} path rejects a JSON-null code`)
  assert.match(validation, /jsonb_typeof\(statement->'text'\)\s*<>\s*'string'/i, `${kind} path rejects numeric text`)
}

const submitSds = functionDefinition('submit_chemical_sds_version')
assert.match(submitSds, /where id = p_version_id\s+for update/i)
assert.match(submitSds, /current_row\.status\s*<>\s*'draft'/i)
assert.match(
  submitSds,
  /update public\.chemical_sds_versions[\s\S]*?set status = 'in_review', submitted_by = p_actor_id, submitted_at = now\(\)[\s\S]*?where id = p_version_id/i,
  'SDS submit records actor and timestamp',
)
assert.match(
  submitSds,
  /insert into public\.audit_log\(action, user_id, target, detail\)[\s\S]*?'chemical_safety\.sds\.submit'[\s\S]*?'before', current_row\.status, 'after', 'in_review'/i,
  'SDS submit writes its action-specific audit',
)

const reviewSds = functionDefinition('review_chemical_sds_version')
assert.match(reviewSds, /where id = p_version_id for update/i)
assert.match(reviewSds, /current_row\.status\s*<>\s*'in_review'/i)
assert.match(reviewSds, /current_row\.submitted_by\s*=\s*p_actor_id/i)
assert.match(reviewSds, /p_decision is null or p_decision not in \('approved','rejected'\)/i)
assert.match(
  reviewSds,
  /p_decision = 'rejected'[\s\S]*?nullif\(btrim\(p_reason\), ''\) is null[\s\S]*?raise exception 'rejection_reason_required'/i,
)
assert.match(
  reviewSds,
  /update public\.chemical_sds_versions[\s\S]*?status = 'superseded'[\s\S]*?returning \*[\s\S]*?insert into public\.audit_log[\s\S]*?chemical_safety\.sds\.supersede/i,
  'every superseded version is returned and audited',
)
assert.match(reviewSds, /update public\.chemical_sds_versions as reviewed_version[\s\S]*?returning to_jsonb\(reviewed_version\) into reviewed_after/i)
assert.match(reviewSds, /chemical_safety\.sds\.review[\s\S]*?'before', to_jsonb\(current_row\)[\s\S]*?'after', reviewed_after/i)

assert.match(sql, /create or replace function public\.guard_chemical_import_batch_provenance/i)
const batchGuard = functionDefinition('guard_chemical_import_batch_provenance')
for (const column of ['id', 'source_kind', 'source_name', 'source_path', 'source_sha256', 'source_r2_key', 'parser_version', 'imported_by', 'created_at']) {
  assert.match(batchGuard, new RegExp(`new\\.${column} is distinct from old\\.${column}`, 'i'), `batch ${column} immutable`)
}
assert.match(
  batchGuard,
  /old\.status in \('completed','reviewed','committed','imported'\)[\s\S]*?new\.status not in \('completed','reviewed','committed','imported'\)[\s\S]*?raise exception 'import_batch_status_regression'/i,
  'terminal import evidence cannot be made deletable by regressing its status',
)
const batchDeleteGuard = batchGuard.match(/if tg_op = 'delete' then([\s\S]*?)end if;/i)?.[1]
assert.ok(batchDeleteGuard, 'batch delete guard exists')
assert.match(batchDeleteGuard, /raise exception 'immutable_import_batch_delete'/i)
assert.doesNotMatch(batchDeleteGuard, /\bif\b|\bexists\b|old\./i, 'every import batch delete is rejected unconditionally')
assert.match(sql, /create trigger chemical_import_batches_provenance_guard\s+before update or delete on public\.chemical_import_batches/i)

assert.match(sql, /create or replace function public\.guard_chemical_import_row_provenance/i)
const rowGuard = functionDefinition('guard_chemical_import_row_provenance')
for (const column of ['id', 'batch_id', 'row_key', 'raw_data', 'created_at']) {
  assert.match(rowGuard, new RegExp(`new\\.${column} is distinct from old\\.${column}`, 'i'), `row ${column} immutable`)
}
assert.match(rowGuard, /tg_op = 'delete'[\s\S]*?raise exception 'immutable_import_row_delete'/i)
assert.doesNotMatch(rowGuard, /new\.(normalized_data|match_status|conflict_codes|target_product_id|decision_note|decided_by|decided_at) is distinct from old\./i)
assert.doesNotMatch(batchGuard, /new\.(status|summary) is distinct from old\./i)
assert.match(sql, /create trigger chemical_import_rows_provenance_guard\s+before update or delete on public\.chemical_import_rows/i)

const seedBlock = sql.match(/cross join \(values([\s\S]*?)\) as location\(code, zone_code, location_kind, display_order\)/i)?.[1]
assert.ok(seedBlock, 'location seed block exists')
const seededCodes = [...seedBlock.matchAll(/\('([A-Z]\d)'/g)].map(match => match[1])
assert.deepEqual(seededCodes, ['A1','A2','B1','B2','B3','B4','C1','C2','C3','C4','C5','T1','T2'])
for (const code of seededCodes) {
  const kind = code.startsWith('T') ? 'table' : 'cabinet'
  assert.match(seedBlock, new RegExp(`\\('${code}', '${code[0]}', '${kind}', \\d+\\)`), `${code} seed kind`)
}
assert.match(sql, /values \('chemical-prep', 'ห้องเตรียมสารเคมี', 'chemical-prep'\)\s+on conflict \(code\) do nothing/i)
assert.match(sql, /on conflict \(room_id, code\) do nothing/i)

assert.doesNotMatch(sql, /execute\s+format\s*\(/i, 'change snapshots never use dynamic SQL')
assert.doesNotMatch(sql, /chemical_(stock_ledger|purchase_orders|procurement)/i, 'no stock ledger or procurement scope')
assert.doesNotMatch(sql, /(infer|derive)_ghs|ghs_(infer|derive)/i, 'no GHS inference')
assert.doesNotMatch(sql, /(infer|derive)[\s_]+compatib|compatib[\s_]+(infer|derive)/i, 'no compatibility inference')
assert.doesNotMatch(sql, /chemical_import[\s\S]{0,80}set\s+status\s*=\s*'approved'/i, 'imports never auto-approve SDS')
assert.doesNotMatch(sql, /legacy[\s\S]{0,80}status\s*=\s*'approved'/i, 'legacy documents never auto-approve')
assert.match(sdsTable, /status text not null default 'draft'/i, 'new/imported SDS remains draft until review')
assert.doesNotMatch(batchGuard + rowGuard, /chemical_sds_versions/i, 'import provenance guards never publish SDS')

console.log('chemical safety schema contract passed')
