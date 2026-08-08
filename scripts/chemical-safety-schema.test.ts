import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync('scripts/chemical-safety-module.sql', 'utf8')
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts?: Record<string, string>
}
const chemicalAccess = readFileSync('lib/chemical-safety/access.ts', 'utf8')
const safetyAccess = readFileSync('lib/lab-map/safety-access.ts', 'utf8')
const staffSidebar = readFileSync('components/layout/StaffSidebar.tsx', 'utf8')
const publicNav = readFileSync('components/layout/PublicNav.tsx', 'utf8')
const publicSdsPage = readFileSync('app/(public)/sds/page.tsx', 'utf8')
const publicSdsApi = readFileSync('app/api/public/sds/route.ts', 'utf8')
const publicSdsFileApi = readFileSync('app/api/public/sds/[publicId]/file/route.ts', 'utf8')
const publicDepartmentSdsApi = readFileSync('app/api/public/department-sds/route.ts', 'utf8')
const publicDepartmentSdsFileApi = readFileSync('app/api/public/department-sds/[publicId]/file/route.ts', 'utf8')
const adminDepartmentSdsFileApi = readFileSync('app/api/admin/chemical-safety/department-sds/[code]/file/route.ts', 'utf8')
const departmentSdsUploadApi = readFileSync('app/api/admin/chemical-safety/department-sds/[code]/upload/route.ts', 'utf8')
const publicModule = readFileSync('lib/chemical-safety/public.ts', 'utf8')
const ghsSql = readFileSync('scripts/chemical-safety-ghs-and-departments.sql', 'utf8')
const registryCrudSql = readFileSync('scripts/chemical-safety-registry-crud.sql', 'utf8')
const chemicalSchemas = readFileSync('lib/chemical-safety/schemas.ts', 'utf8')
const changeRequestsRoute = readFileSync('app/api/admin/chemical-safety/change-requests/route.ts', 'utf8')
const changeRequestsSubmitRoute = readFileSync('app/api/admin/chemical-safety/change-requests/[id]/submit/route.ts', 'utf8')

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
for (const required of [
  'scripts/chemical-safety-schema.test.ts',
  'lib/chemical-safety/domain.test.ts',
  'lib/chemical-safety/ghs.test.ts',
  'lib/chemical-safety/departments.test.ts',
  'lib/chemical-safety/materialize.test.ts',
  'lib/chemical-safety/import/masterlist-june-2026.test.ts',
  'lib/chemical-safety/import/sds-import.test.ts',
  'scripts/chemical-safety-import-cli.test.ts',
  'scripts/chemical-safety-import-runtime.test.ts',
  'scripts/chemical-safety-ui.test.ts',
]) {
  assert.ok(
    packageJson.scripts?.['test:chemical-safety']?.includes(`tsx ${required}`),
    `test:chemical-safety must run ${required}`,
  )
}

// ── การย้ายฐานข้อมูลรอบ GHS + คลังเอกสารตามงาน ─────────────────────────────
assert.match(ghsSql.trim(), /^--[\s\S]*\bBEGIN;/i, 'the GHS migration starts a transaction')
assert.match(ghsSql.trim(), /NOTIFY pgrst, 'reload schema';\s*COMMIT;$/i, 'the GHS migration commits after schema reload')
for (const column of ['ghs_source_text', 'ghs_pictogram_codes', 'ghs_hazard_classes']) {
  assert.match(ghsSql, new RegExp(`add column if not exists ${column}`, 'i'), `chemical_products gains ${column}`)
}
// สัญลักษณ์ต้องจำกัดอยู่ใน GHS01–GHS09 เท่านั้น ไม่ปล่อยให้เขียนค่าอะไรก็ได้
assert.match(ghsSql, /ghs_pictogram_codes <@ ARRAY\[[\s\S]*?'GHS09'/i, 'product pictograms are constrained to the GHS set')
// รหัส H/P แบบผสมและแบบมีตัวอักษรต่อท้ายต้องบันทึกได้ ไม่งั้นการกรอก SDS จริงจะล้ม
assert.match(ghsSql, /\^H\[0-9\]\{3\}\[A-Za-z\]\{0,2\}\$/, 'H-codes accept a trailing suffix such as H350i')
assert.match(ghsSql, /\^P\[0-9\]\{3\}\(\\\+P\?\[0-9\]\{3\}\)\*\$/, 'P-codes accept combinations such as P301+P310')
for (const table of ['chemical_sds_departments', 'chemical_department_sds']) {
  assert.match(ghsSql, new RegExp(`create table if not exists public\\.${table}`, 'i'), `migration creates ${table}`)
  assert.match(ghsSql, new RegExp(`alter table public\\.${table}[\\s\\S]{0,80}enable row level security`, 'i'), `${table} enables RLS`)
}
assert.match(
  ghsSql,
  /REVOKE ALL ON public\.chemical_sds_departments, public\.chemical_department_sds\s+FROM anon, authenticated/i,
  'department SDS tables are never readable by anon or authenticated roles directly',
)
// การเผยแพร่ต้องบันทึกเสมอว่าใครกดและเมื่อไร
assert.match(
  ghsSql,
  /status = 'published' AND published_by IS NOT NULL AND published_at IS NOT NULL/i,
  'publishing a department always records who and when',
)

// ฝั่งเจ้าหน้าที่ใช้สิทธิ์ Admin/Manager, safety editor หรือ scope ที่ได้รับมอบหมาย
const accessDecision = chemicalAccess.match(/export async function chemicalAccessDecision\([\s\S]*?\n\}/)?.[0] ?? ''
assert.match(accessDecision, /isSafetyEditor\(actor\)/, 'lab-map safety editors can access chemical-safety work')
assert.match(accessDecision, /request\.action === 'manage_roles'\) return false/, 'only Admin can manage chemical role scopes')
assert.match(accessDecision, /scopes\.some/, 'assigned chemical scopes can access their assigned unit action')
assert.doesNotMatch(accessDecision, /request\.action === 'view'\) return true/, 'ordinary staff cannot view chemical-safety data')
assert.match(safetyAccess, /\['Admin', 'Manager'\]/, 'Admin and Manager are safety managers')
assert.match(staffSidebar, /href: '\/staff\/lab-map\/chemicals'[\s\S]*?safetyEditor: true/, 'chemical room menu is available to lab-map safety editors')
assert.doesNotMatch(staffSidebar, /href: '\/staff\/lab-map\/sds'/, 'SDS is accessed through the chemical room menu')

// ฝั่งสาธารณะเปิดให้ทุกคนตามที่ผู้ใช้ระบุ: ผังการจัดเก็บ การจำแนก GHS และ SDS ของทุกงาน
// ข้อมูลถูกคัดกรองในชั้น lib/chemical-safety/public.ts ไม่ใช่ด้วย guard ที่ route
// หน้ายังเปิดสาธารณะอยู่ (เข้าตรง /sds ได้) แต่ผู้ใช้ขอให้เอาออกจากเมนูบนสุดของ public nav
assert.doesNotMatch(publicNav, /href: '\/sds'/, 'public navigation no longer surfaces the SDS link in the top menu')
for (const source of [publicSdsPage, publicSdsApi, publicSdsFileApi, publicDepartmentSdsApi, publicDepartmentSdsFileApi]) {
  assert.doesNotMatch(source, /requireChemical/, 'public SDS entry points must not require a login')
}
for (const source of [publicSdsApi, publicSdsFileApi, publicDepartmentSdsApi, publicDepartmentSdsFileApi]) {
  assert.match(source, /consumeClientRateLimit/, 'every public SDS route is rate limited')
}
// ไฟล์ของงานต้องตรวจสถานะเผยแพร่ซ้ำที่ชั้นข้อมูล ไม่ใช่พึ่งว่า UI จะไม่แสดงลิงก์
assert.match(
  publicModule,
  /getPublicDepartmentSdsFile[\s\S]*?status !== 'published'[\s\S]*?return null/,
  'department SDS files are only served for published departments',
)
assert.match(departmentSdsUploadApi, /requireDepartmentSdsPublisher/, 'อัปโหลด SDS แยกตามงานต้องตรวจสิทธิ์ผู้จัดการงาน')
assert.match(departmentSdsUploadApi, /validateChemicalPdf/, 'อัปโหลด SDS แยกตามงานต้องตรวจชนิดและลายเซ็น PDF')
assert.match(departmentSdsUploadApi, /status: 'draft', published_by: null, published_at: null/, 'เพิ่มไฟล์ในงานที่เผยแพร่แล้วต้องกลับสู่ฉบับร่างเพื่อทบทวนใหม่')
assert.match(adminDepartmentSdsFileApi, /requireChemicalViewer/, 'เจ้าหน้าที่ต้องเปิดดู SDS แยกตามงานได้แม้งานยังเป็นฉบับร่าง')
assert.match(adminDepartmentSdsFileApi, /chemical_department_sds/, 'route เปิดไฟล์เจ้าหน้าที่ต้องค้นจากรายการ SDS แยกตามงาน')
// สารที่ SDS ยังไม่อนุมัติต้องไม่มี URL ไฟล์ แม้จะแสดงการจำแนก GHS บนหน้าสาธารณะ
assert.match(publicModule, /viewUrl: approved \?/, 'pending chemicals expose no file URL')
assert.match(
  publicModule,
  /getPublicSdsFile[\s\S]*?\.eq\('status', 'approved'\)/,
  'the public file route still requires an approved SDS version',
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
  'merge_chemical_sds_file_source_paths',
])
const applicationRpcNames = createdFunctionNames.filter(name => !infrastructureFunctionNames.has(name))
assert.deepEqual(
  applicationRpcNames,
  Object.keys(rpcSignatures),
  'migration creates exactly the five required application RPCs',
)
assert.equal(applicationRpcNames.length, 5, 'application RPC count')
assert.equal(createdFunctionNames.length, 9, 'only the five RPCs and four named infrastructure functions exist')

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

const sourcePathMerge = functionDefinition('merge_chemical_sds_file_source_paths')
assert.match(sourcePathMerge, /jsonb_array_elements_text\(old\.source_paths\)/i)
assert.match(sourcePathMerge, /jsonb_array_elements_text\(new\.source_paths\)/i)
assert.match(sourcePathMerge, /select distinct/i, 'source paths are atomically deduplicated')
assert.match(sourcePathMerge, /jsonb_agg\([\s\S]*?order by/i, 'merged source paths are sorted')
assert.match(
  sql,
  /create trigger chemical_sds_files_source_paths_merge\s+before update of source_paths on public\.chemical_sds_files\s+for each row execute function public\.merge_chemical_sds_file_source_paths\(\)/i,
  'SDS source path merge runs inside the conflicting upsert update',
)
assert.match(
  sql,
  /revoke all on function public\.merge_chemical_sds_file_source_paths\(\)\s+from PUBLIC, anon, authenticated, service_role/i,
  'source-path trigger function is not directly callable',
)

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

// ─────────────────────────────────────────────────────────────────────────────
// เพิ่ม/แก้ไข/เลิกใช้งานสารเคมีในทะเบียน — ผ่าน workflow เสนอ→ทบทวน→อนุมัติเดิม
// ก่อนหน้านี้ไม่มีทางเพิ่มสารเคมีใหม่เข้าทะเบียนได้เลย (entity_id บังคับอ้างของที่มีอยู่แล้วเสมอ)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(registryCrudSql.trim(), /^--[\s\S]*\bBEGIN;/i, 'the registry CRUD migration starts a transaction')
assert.match(registryCrudSql.trim(), /NOTIFY pgrst, 'reload schema';\s*COMMIT;$/i, 'the registry CRUD migration commits after schema reload')

assert.match(registryCrudSql, /ALTER TABLE public\.chemical_change_requests ALTER COLUMN entity_id DROP NOT NULL/i, 'entity_id becomes nullable for new-chemical requests')
assert.match(registryCrudSql, /CHECK \(entity_type IN \('product', 'holding', 'new_chemical'\)\)/, 'entity_type accepts new_chemical')
assert.match(
  registryCrudSql,
  /entity_type = 'new_chemical' AND entity_id IS NULL[\s\S]{0,80}entity_type IN \('product', 'holding'\) AND entity_id IS NOT NULL/,
  'entity_id is required for edits and forbidden for new-chemical requests — the two must not both be allowed',
)

// สาขา 'product' และ 'holding' เดิมต้องอยู่ครบ ไม่ถูกเขียนทับหายไปตอนแทนที่ทั้งฟังก์ชัน
for (const marker of [
  "current_row.entity_type = 'product'",
  "current_row.entity_type = 'holding'",
  "current_row.entity_type = 'new_chemical'",
  'self_approval_forbidden',
  'invalid_new_chemical_snapshot',
  'chemical_location_not_found',
]) {
  assert.ok(registryCrudSql.includes(marker), `review_chemical_change_request must still handle: ${marker}`)
}
// การสร้างสารใหม่ต้องแทรกทั้งสามตาราง (สาร → หน่วยงานที่เชื่อมโยง → คลัง) ในธุรกรรมเดียว
assert.match(registryCrudSql, /INSERT INTO public\.chemical_products/i)
assert.match(registryCrudSql, /INSERT INTO public\.chemical_unit_products/i)
assert.match(registryCrudSql, /INSERT INTO public\.chemical_inventory_holdings/i)
// รหัส GHS ตอนสร้างใหม่ต้องเช็คว่าอยู่ในเซ็ต GHS01–09 เท่านั้น เหมือนคอลัมน์ระดับ product
assert.match(registryCrudSql, /GHS01','GHS02','GHS03','GHS04','GHS05','GHS06','GHS07','GHS08','GHS09/)
// หมวดความเป็นอันตรายต้องใช้ฟังก์ชันตรวจรูปร่างเดียวกับที่ chemical_products ใช้ ไม่ประกาศซ้ำ
assert.match(registryCrudSql, /public\.chemical_ghs_hazard_classes_valid\(current_row\.proposed_data->'ghs_hazard_classes'\)/)

// zod: schema ใหม่ต้องมีอยู่จริงและ union ต้องรับ new_chemical โดยไม่บังคับ entityId
assert.match(chemicalSchemas, /export const chemicalNewChemicalProposalSchema/, 'chemicalNewChemicalProposalSchema exists')
assert.match(
  chemicalSchemas,
  /entityType: z\.literal\('new_chemical'\), unitId: uuid, proposedData: chemicalNewChemicalProposalSchema/,
  'the new_chemical branch of the discriminated union has no entityId field',
)

// API: เส้นทางเดิมต้องรองรับ entity_id เป็น null สำหรับ new_chemical และมี GET ให้แผงรอทบทวนใช้
assert.match(changeRequestsRoute, /export async function GET/, 'change-requests route exposes a GET for the pending-review panel')
assert.match(
  changeRequestsRoute,
  /entityType === 'product' \|\| input\.data\.entityType === 'holding'[\s\S]{0,80}: null/,
  'new-chemical and department-chemical requests store a null entity_id instead of a bogus one',
)
assert.match(
  changeRequestsSubmitRoute,
  /entityType === 'new_chemical'\)\s*return chemicalNewChemicalProposalSchema/,
  'draft edit/submit validate new_chemical proposals with their own schema',
)

console.log('chemical safety schema contract passed')
