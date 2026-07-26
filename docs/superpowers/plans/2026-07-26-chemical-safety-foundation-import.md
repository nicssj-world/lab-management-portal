# Chemical Safety Foundation and Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the protected chemical-safety data foundation and import the supplied June 2026 master list, 13-position storage plan, and MSDS 2568 archive into a reviewable, non-public staging state.

**Architecture:** Keep approved/current records in normalized Postgres tables and preserve every source artifact and raw extracted row in immutable import tables. A source-bound master-list adapter verifies the exact PDF hash before returning its 25 checked rows; a recursive SDS indexer hashes files, extracts safe metadata, uploads private blobs once, and creates review candidates without auto-approval.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.4, TypeScript 5, Supabase/Postgres, private Cloudflare R2 through the existing S3 client, Zod 3.25, `unpdf` 1.6, Node `crypto`, Node `assert` + `tsx` tests.

## Global Constraints

- Source design: `docs/superpowers/specs/2026-07-26-chemical-room-sds-design.md`.
- Read the relevant installed Next.js 16 guidance under `node_modules/next/dist/docs/` before changing routes, Route Handlers, Proxy, or Server/Client boundaries.
- This is a chemical registry and editable current-quantity snapshot, not a receive/issue/transfer stock ledger.
- Do not add procurement, purchase requests, automatic replenishment, or automatic chemical-compatibility decisions.
- Preserve raw imported values and source hashes; normalized corrections never overwrite source evidence.
- GHS data is not inferred from a filename, location color, or the master list's free text. It requires the exact product SDS and bottle-label review.
- Every imported SDS remains draft/quarantined until a separate reviewer approves it.
- Legacy DOC/DOCX/HTML files remain review evidence; do not auto-convert them into an approved public SDS.
- Initial source PDF: `C:\Users\User\Downloads\Unit Chemical Inventory List ห้องเก็บสารเคมี (1).pdf`, SHA-256 `71d25b0e50b3056f97edb3238a1a7949584744f67fc0bfbafcaa70273d83ddb`.
- Initial storage image: `E:\ISO\ISO15190\safety\ห้องสาร\ผังสารเคมี.png`, SHA-256 `5195b2f1d00672c3f625e464abc743ab9ef0ee2de6215bf64222453f5f7a951d`.
- Initial SDS root: `C:\Users\User\Downloads\MSDS 2568`; the baseline scan is 556 files: 521 PDF, 18 DOCX, 16 DOC, and 1 HTML.
- Import commands are dry-run by default and require `--apply` for database/R2 writes.
- Do not publish `/sds`, QR targets, or any imported file in this phase.

---

### Task 1: Add the chemical-safety schema and transition functions

**Files:**
- Create: `scripts/chemical-safety-module.sql`
- Create: `scripts/chemical-safety-schema.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: normalized `chemical_*` tables, service-role-only RLS, current-version uniqueness constraints, and transaction-safe submit/review functions.
- Produces RPCs: `submit_chemical_change_request(uuid, uuid)`, `review_chemical_change_request(uuid, uuid, text, text)`, `update_chemical_sds_draft(uuid, uuid, timestamptz, jsonb, jsonb)`, `submit_chemical_sds_version(uuid, uuid)`, and `review_chemical_sds_version(uuid, uuid, text, text)`.
- Consumes: `profiles(id)` for actors and `audit_log` for durable before/after audit entries.

- [ ] **Step 1: Write the failing schema contract test**

Create `scripts/chemical-safety-schema.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx tsx scripts/chemical-safety-schema.test.ts`

Expected: FAIL with `ENOENT: no such file or directory, open 'scripts/chemical-safety-module.sql'`.

- [ ] **Step 3: Create the normalized tables and constraints**

Create `scripts/chemical-safety-module.sql` inside `BEGIN; ... COMMIT;`. Use UUID primary keys with `gen_random_uuid()` and these exact responsibilities:

```sql
create table if not exists public.chemical_units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_th text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.chemical_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_th text not null,
  map_space_code text references public.lab_map_spaces(code) on update cascade on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chemical_storage_locations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chemical_rooms(id) on delete restrict,
  code text not null,
  zone_code text not null check (zone_code in ('A','B','C','T')),
  location_kind text not null check (location_kind in ('cabinet','shelf','table')),
  display_order integer not null check (display_order > 0),
  display_geometry jsonb,
  active boolean not null default true,
  unique (room_id, code)
);

create table if not exists public.chemical_products (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  canonical_name text not null,
  cas_number text,
  manufacturer text,
  supplier text,
  product_code text,
  concentration text,
  physical_state text check (physical_state is null or physical_state in ('solid','liquid','gas','mixture','unknown')),
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active','retired')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Continue with:

- `chemical_product_aliases(product_id, alias, normalized_alias)` and a unique normalized alias per product;
- `chemical_unit_products(product_id, unit_id, preferred_name, active, public_eligible)` with a composite primary key;
- `chemical_inventory_holdings(product_id, unit_id, location_id, lot_number, package_value, package_unit, current_container_count, minimum_stock, reported_total_raw, calculated_total_value, calculated_total_unit, received_on, opened_on, expires_on, effective_on, approved_by, approved_at, updated_at)`; package/count fields reject negative values and dates may be null;
- `chemical_sds_files(sha256, r2_key, file_name, content_type, size_bytes, source_paths jsonb, created_at)` where SHA-256 and R2 key are unique, `source_paths` defaults to `[]`, and size is `1..52428800` bytes;
- `chemical_sds_versions(product_id, file_id, source_url, manufacturer, supplier, product_code, concentration, language, revision_label, effective_on, review_due_on, signal_word, pictogram_codes text[], h_statements jsonb, p_statements jsonb, storage_instructions, incompatibilities, emergency_summary, status, submitted_by, submitted_at, reviewed_by, reviewed_at, review_reason, created_by, created_at, updated_at)`; statement JSON is an array of `{ "code": "Hxxx|Pxxx", "text": "verbatim approved SDS text" }` objects;
- `chemical_sds_hazards(sds_version_id, hazard_class, hazard_category)` with a composite unique constraint;
- `chemical_role_scopes(user_id, unit_id, role)` where role is `custodian` or `reviewer` and `(user_id, unit_id, role)` is the primary key;
- `chemical_change_requests(entity_type, entity_id, unit_id, proposed_data jsonb, status, submitted_by, submitted_at, reviewed_by, reviewed_at, review_reason, created_by, created_at, updated_at)` for product/holding drafts;
- `chemical_import_batches(source_kind, source_name, source_path, source_sha256, source_r2_key, parser_version, status, summary jsonb, imported_by, created_at)` with unique `(source_kind, source_sha256)`;
- `chemical_import_rows(batch_id, row_key, raw_data jsonb, normalized_data jsonb, match_status, conflict_codes text[], target_product_id, decision_note, decided_by, decided_at, created_at)` with unique `(batch_id, row_key)`;
- `chemical_qr_tokens(token_hash, target_type, target_id, active, created_by, created_at, revoked_by, revoked_at)`; store only the SHA-256 hash of the raw token.

Use the same workflow status check `('draft','in_review','approved','superseded','rejected')` on SDS versions and `('draft','in_review','approved','rejected')` on change requests. Add a partial unique index that permits only one `approved` SDS version per product.

- [ ] **Step 4: Add transactional state functions and audit entries**

Each submit function locks its target row, accepts only `draft`, sets `in_review`, submitter/time, and inserts an `audit_log` action. Each review function locks the row, accepts only `in_review`, rejects `p_actor_id = submitted_by`, requires decision `approved|rejected`, and inserts before/after JSON into `audit_log.detail` in the same transaction. Add table checks `reviewed_by is null or submitted_by is null or reviewed_by <> submitted_by` as defense in depth.

When approving an SDS, first set any previous approved version for that product to `superseded`, then approve the selected version. When approving a `chemical_change_requests` row, apply its complete validated snapshot to either `chemical_products` or `chemical_inventory_holdings` and retain the proposal/audit record; never execute dynamic SQL assembled from arbitrary JSON keys.

`update_chemical_sds_draft` locks the version, requires status `draft`, requires the caller to be the creator or submitter, compares `updated_at` to the supplied optimistic-lock value, updates the explicit metadata/GHS fields from validated JSON keys, replaces `chemical_sds_hazards` from the validated hazard array, updates `updated_at`, and inserts one before/after audit entry in the same transaction. It raises `stale_sds_draft` on a timestamp mismatch.

Use this function shape:

```sql
create or replace function public.review_chemical_sds_version(
  p_version_id uuid, p_actor_id uuid, p_decision text, p_reason text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare current_row public.chemical_sds_versions%rowtype;
begin
  select * into current_row from public.chemical_sds_versions
    where id = p_version_id for update;
  if not found then raise exception 'sds_not_found'; end if;
  if current_row.status <> 'in_review' then raise exception 'sds_not_in_review'; end if;
  if current_row.submitted_by = p_actor_id then raise exception 'self_approval_forbidden'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
  if p_decision = 'approved' then
    update public.chemical_sds_versions set status = 'superseded'
      where product_id = current_row.product_id and status = 'approved' and id <> p_version_id;
  end if;
  update public.chemical_sds_versions set status = p_decision,
    reviewed_by = p_actor_id, reviewed_at = now(), review_reason = nullif(btrim(p_reason), '')
    where id = p_version_id;
  insert into public.audit_log(action, user_id, target, detail)
    values ('chemical_safety.sds.review', p_actor_id, p_version_id::text,
      jsonb_build_object('before', current_row.status, 'after', p_decision, 'reason', p_reason)::text);
  return p_version_id;
end;
$$;
```

Revoke every transition function from `PUBLIC, anon, authenticated` and grant execute only to `service_role`.

- [ ] **Step 5: Enable RLS, restrict tables, and seed the room shell**

Enable RLS on every new table, revoke all from `anon, authenticated`, and grant table access only to `service_role`, matching existing safety-module practice. Seed `chemical-prep` and the 13 location codes with `ON CONFLICT DO NOTHING`; use `table` for T1/T2 and `cabinet` for A/B/C positions. End with `NOTIFY pgrst, 'reload schema';`.

- [ ] **Step 6: Run the schema test**

Run: `npx tsx scripts/chemical-safety-schema.test.ts`

Expected: `chemical safety schema contract passed`.

- [ ] **Step 7: Add the focused package script and commit**

Add this script to `package.json`:

```json
"test:chemical-safety": "tsx scripts/chemical-safety-schema.test.ts"
```

Run: `npm run test:chemical-safety`

Expected: `chemical safety schema contract passed`.

```bash
git add scripts/chemical-safety-module.sql scripts/chemical-safety-schema.test.ts package.json
git commit -m "feat(chemical-safety): add registry and SDS schema"
```

---

### Task 2: Define the chemical domain, quantity checks, and storage manifest

**Files:**
- Create: `lib/chemical-safety/types.ts`
- Create: `lib/chemical-safety/domain.ts`
- Create: `lib/chemical-safety/storage-manifest.ts`
- Create: `lib/chemical-safety/domain.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `ChemicalProductDTO`, `ChemicalHoldingDTO`, `ChemicalSdsDTO`, `ChemicalRegistryRow`, `ChemicalStorageLocationDefinition`.
- Produces: `normalizeChemicalName`, `normalizeCasNumber`, `calculateHoldingTotal`, `detectQuantityConflict`, and `currentSdsState`.
- Produces: `CHEMICAL_PREP_LOCATIONS` and `INITIAL_POSITION_ASSIGNMENTS` containing exactly 13 locations and 25 product assignments.

- [ ] **Step 1: Write the failing domain test**

Create `lib/chemical-safety/domain.test.ts`:

```ts
import assert from 'node:assert/strict'
import { calculateHoldingTotal, detectQuantityConflict, normalizeChemicalName } from './domain'
import { CHEMICAL_PREP_LOCATIONS, INITIAL_POSITION_ASSIGNMENTS } from './storage-manifest'

assert.equal(CHEMICAL_PREP_LOCATIONS.length, 13)
assert.equal(INITIAL_POSITION_ASSIGNMENTS.length, 25)
assert.deepEqual(INITIAL_POSITION_ASSIGNMENTS.filter(x => x.positionCode === 'B3').map(x => x.name), [
  'Acetic acid', 'Ethanol', 'Formic acid',
])
assert.deepEqual(INITIAL_POSITION_ASSIGNMENTS.filter(x => x.positionCode === 'B4').map(x => x.name), [
  'Permount/Toluene solution', 'Propan-2-ol', 'Xylene',
])
assert.equal(normalizeChemicalName('  PROPAN-2-OL '), 'propan-2-ol')
assert.deepEqual(calculateHoldingTotal([{ value: 500, unit: 'mL', count: 7 }]), { value: 3.5, unit: 'L' })
assert.equal(detectQuantityConflict({ calculated: { value: 3.5, unit: 'L' }, reportedRaw: '18 ลิตร' }), true)
assert.equal(detectQuantityConflict({ calculated: { value: 5, unit: 'L' }, reportedRaw: '5 ลิตร' }), false)

console.log('chemical safety domain tests passed')
```

- [ ] **Step 2: Verify the test fails**

Run: `npx tsx lib/chemical-safety/domain.test.ts`

Expected: FAIL because `domain.ts` and `storage-manifest.ts` do not exist.

- [ ] **Step 3: Add serializable domain types**

Create `lib/chemical-safety/types.ts` with explicit string unions:

```ts
export type ChemicalWorkflowStatus = 'draft' | 'in_review' | 'approved' | 'superseded' | 'rejected'
export type ChemicalLifecycleStatus = 'active' | 'retired'
export type GhsPictogramCode = 'GHS01'|'GHS02'|'GHS03'|'GHS04'|'GHS05'|'GHS06'|'GHS07'|'GHS08'|'GHS09'
export type QuantityUnit = 'mL' | 'L' | 'g' | 'kg'
export type SdsMatchStatus = 'candidate' | 'mismatch' | 'missing' | 'unsupported' | 'duplicate'

export interface ChemicalRegistryFilters {
  q?: string
  unitId?: string
  roomId?: string
  positionCode?: string
  sdsStatus?: 'approved' | 'draft' | 'mismatch' | 'missing' | 'review_due'
  ghs?: GhsPictogramCode
  lifecycle?: ChemicalLifecycleStatus
}

export interface ChemicalRegistryRow {
  productId: string
  publicId: string
  canonicalName: string
  aliases: string[]
  casNumber: string | null
  concentration: string | null
  packageValue: number | null
  packageUnit: QuantityUnit | null
  currentContainerCount: number | null
  minimumStock: number | null
  reportedTotalRaw: string | null
  calculatedTotalValue: number | null
  calculatedTotalUnit: QuantityUnit | null
  quantityConflict: boolean
  positionCode: string | null
  unitId: string
  unitName: string
  sdsStatus: string
  pictogramCodes: GhsPictogramCode[]
  signalWord: string | null
  hazards: Array<{ className: string; category: string }>
  hStatements: Array<{ code: string; text: string }>
  updatedAt: string
}
```

Add DTOs for rooms/locations, SDS version metadata, hazard rows, import batches/rows, review decisions, and role scopes using the same database field meanings from Task 1.

- [ ] **Step 4: Implement normalization and quantity arithmetic**

`calculateHoldingTotal` accepts multiple package parts, converts mL→L and g→kg only when the total reaches 1000, rejects mixing mass and volume, and rounds to six decimals. `detectQuantityConflict` parses Thai/English `mL`, `L`, `g`, and `kg` text and uses a `1e-6` tolerance. It returns `true` for unparseable non-empty reported totals so the custodian must inspect them.

`currentSdsState` returns `approved`, `review_due`, `draft`, `mismatch`, or `missing`; an approved SDS becomes `review_due` when `reviewDueOn < todayIso` but remains internally identifiable as approved with a due warning.

- [ ] **Step 5: Encode the exact current storage plan**

Create `CHEMICAL_PREP_LOCATIONS` in A1/A2/B1…C5/T1/T2 display order and `INITIAL_POSITION_ASSIGNMENTS` with the complete 25-name mapping from the approved spec. Treat group color as position identity only:

```ts
export const LOCATION_GROUP_COLORS = {
  A: '#1557C0', B: '#137333', C: '#F04B00', T: '#642A91',
} as const
```

Do not include hazard classification in this manifest.

- [ ] **Step 6: Run and register domain tests**

Update the package script:

```json
"test:chemical-safety": "tsx scripts/chemical-safety-schema.test.ts && tsx lib/chemical-safety/domain.test.ts"
```

Run: `npm run test:chemical-safety`

Expected: schema and domain tests print their passed messages.

- [ ] **Step 7: Commit the domain layer**

```bash
git add lib/chemical-safety package.json
git commit -m "feat(chemical-safety): define registry domain and storage plan"
```

---

### Task 3: Build the source-bound June 2026 master-list adapter

**Files:**
- Create: `lib/chemical-safety/import/masterlist-june-2026.ts`
- Create: `lib/chemical-safety/import/masterlist-june-2026.test.ts`
- Create: `lib/chemical-safety/import/source-files.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `readJune2026Masterlist(pdfPath): Promise<MasterlistImportSource>`.
- Produces: `MasterlistRawRow`, `MasterlistNormalizedProposal`, `MasterlistImportSource`.
- Produces: `sha256File(path)` and `assertSourceFile(path, expectedSha256)`.

- [ ] **Step 1: Write the failing exact-source test**

Create a test that reads the supplied absolute path only when it exists, always tests the checked source constant, and asserts:

```ts
assert.equal(JUNE_2026_MASTERLIST_SHA256, '71d25b0e50b3056f97edb3238a1a7949584744f67fc0bfbafcaa70273d83ddb')
assert.equal(JUNE_2026_MASTERLIST_ROWS.length, 25)
assert.deepEqual(JUNE_2026_MASTERLIST_ROWS.map(row => row.no), Array.from({ length: 25 }, (_, i) => i + 1))
assert.deepEqual(findConflictNames(JUNE_2026_MASTERLIST_ROWS), [
  'Ammonia solution 30%', 'Ethyl alcohol 95%', 'Formic acid', 'Methanol', 'Wright’s Baso',
])
assert.equal(JUNE_2026_MASTERLIST_ROWS.find(row => row.no === 11)?.reportedTotalRaw, '18 ลิตร')
assert.equal(JUNE_2026_MASTERLIST_ROWS.find(row => row.no === 25)?.rawLocation, 'B3, B4')
```

If the source PDF exists, assert `readJune2026Masterlist()` returns the same SHA, 25 rows, title `Unit Chemical Inventory List`, unit text, and update label `June 2026`.

- [ ] **Step 2: Verify failure**

Run: `npx tsx lib/chemical-safety/import/masterlist-june-2026.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Add immutable raw-row types and the exact checked row snapshot**

Use this boundary:

```ts
export interface MasterlistRawRow {
  no: number
  chemicalName: string
  sdsOnFileRaw: string
  packageRaw: string
  containerCountRaw: string
  minimumStockRaw: string
  reportedTotalRaw: string
  rawGhsText: string
  rawLocation: string
  responsibleUnitRaw: string
}

export interface MasterlistImportSource {
  sha256: string
  title: 'Unit Chemical Inventory List'
  unitDepartment: string
  updatedLabel: 'June 2026'
  rows: MasterlistRawRow[]
}
```

Transcribe all 25 rows from the verified `unpdf` extraction without correcting spelling, free-text GHS, location, quantity, or unit. Preserve `B3, B4` in every affected raw row. Store parsed package parts and the image-derived current position only in a separate normalized proposal builder.

- [ ] **Step 4: Verify the source hash and recognizable text before returning rows**

`readJune2026Masterlist` must:

1. read bytes and calculate SHA-256;
2. reject a hash other than the exact source constant;
3. call `getDocumentProxy` and `extractText(..., { mergePages: true })`;
4. normalize whitespace for verification only;
5. require the title, unit/department text, `Update June 2026`, row 1 name, row 25 name, and every sequence number;
6. return a copy of the immutable checked row snapshot.

This is intentionally source-bound. A changed future master list must receive a new adapter/hash or an explicit reviewed import format; it must not silently reuse June 2026 assumptions.

- [ ] **Step 5: Run tests and update the focused suite**

Append `tsx lib/chemical-safety/import/masterlist-june-2026.test.ts` to `test:chemical-safety`.

Run: `npm run test:chemical-safety`

Expected: the suite confirms 25 rows and the five named conflicts.

- [ ] **Step 6: Commit the master-list adapter**

```bash
git add lib/chemical-safety/import package.json
git commit -m "feat(chemical-safety): parse verified June master list"
```

---

### Task 4: Index, deduplicate, and score SDS archive candidates

**Files:**
- Create: `lib/chemical-safety/import/sds-index.ts`
- Create: `lib/chemical-safety/import/sds-match.ts`
- Create: `lib/chemical-safety/import/sds-import.test.ts`
- Create: `lib/chemical-safety/files.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `indexSdsArchive(rootPath): Promise<SdsIndexedFile[]>`.
- Produces: `scoreSdsCandidate(product, candidate): SdsCandidateScore` and `classifySdsCandidate(score): SdsMatchStatus`.
- Produces: `validateChemicalPdf`, `isPdfSignature`, and safe R2 filename helpers.

- [ ] **Step 1: Write failing archive and matching tests**

Use small in-memory metadata fixtures and assert:

```ts
assert.equal(classifySdsCandidate(scoreSdsCandidate(
  { name: 'Acetic acid', casNumber: '64-19-7', concentration: null },
  { fileName: 'Acetic acid.pdf', extractedText: 'Sodium acetate CAS 127-09-3', sha256: 'a'.repeat(64) },
)), 'mismatch')

assert.equal(classifySdsCandidate(scoreSdsCandidate(
  { name: 'Trifluoroacetic acid', casNumber: '76-05-1', concentration: null },
  { fileName: 'Trifluoroacetic acid.pdf', extractedText: 'TFA-d CAS 599-00-8', sha256: 'b'.repeat(64) },
)), 'mismatch')

assert.equal(classifySdsCandidate(scoreSdsCandidate(
  { name: '70% Alcohol', casNumber: '64-17-5', concentration: '70%' },
  { fileName: 'RCI Ethanol 70%.pdf', extractedText: 'Ethanol 70% CAS 64-17-5 product 05S0031', sha256: 'c'.repeat(64) },
)), 'candidate')
```

Also build a temporary directory fixture with duplicate PDF bytes and unsupported `.doc`; assert recursive relative paths are preserved, duplicate hashes are identified, and `.doc` is `unsupported` rather than discarded.

- [ ] **Step 2: Verify failure**

Run: `npx tsx lib/chemical-safety/import/sds-import.test.ts`

Expected: FAIL because SDS import modules do not exist.

- [ ] **Step 3: Implement safe recursive indexing**

`indexSdsArchive` uses `fs.promises.readdir({ recursive: true, withFileTypes: true })`, never follows symbolic links, records POSIX-style relative paths, and supports `.pdf`, `.docx`, `.doc`, and `.html` as source evidence. For PDF it extracts the first two pages through `unpdf`; for DOCX it may use `mammoth.extractRawText`; DOC and HTML remain metadata-only unsupported candidates for public approval.

Return:

```ts
export interface SdsIndexedFile {
  absolutePath: string
  relativePath: string
  sourceUnitName: string
  extension: '.pdf' | '.docx' | '.doc' | '.html'
  sizeBytes: number
  sha256: string
  extractedText: string | null
  importSupport: 'pdf' | 'metadata_only'
  duplicateOfSha256: string | null
}
```

- [ ] **Step 4: Implement conservative matching evidence**

Normalize names/aliases but retain original values. Extract CAS candidates with `\b\d{2,7}-\d{2}-\d\b`, concentration tokens, manufacturer/supplier/product codes when recognizable, and compare them independently. Any conflicting CAS forces `mismatch`; a missing concentration for a concentration-specific product cannot score above `candidate`; filename-only matches stay `candidate` and never become approved.

Return score plus evidence arrays:

```ts
export interface SdsCandidateScore {
  score: number
  positiveEvidence: string[]
  negativeEvidence: string[]
  exactCas: boolean
  concentrationConfirmed: boolean
  hardMismatch: boolean
}
```

No function in this module returns `approved`.

- [ ] **Step 5: Add PDF validation shared by upload/import**

Accept only `application/pdf`, `.pdf`, 1–50 MB, and a `%PDF-` signature from the first five bytes for approvable files. Sanitize filenames by retaining letters/numbers/Thai/`.`/`-`/`_` and replacing the rest with `_`. Metadata-only legacy files remain import rows but cannot create `chemical_sds_versions` with an approvable file.

- [ ] **Step 6: Run and register tests**

Append `tsx lib/chemical-safety/import/sds-import.test.ts` to `test:chemical-safety`.

Run: `npm run test:chemical-safety`

Expected: known false matches are classified as mismatch, duplicate bytes share a hash, and unsupported legacy files remain visible.

- [ ] **Step 7: Commit SDS indexing and matching**

```bash
git add lib/chemical-safety package.json
git commit -m "feat(chemical-safety): index and match SDS candidates"
```

---

### Task 5: Add the idempotent dry-run/apply importer and load the supplied sources

**Files:**
- Create: `scripts/import-chemical-safety.ts`
- Create: `scripts/chemical-safety-import-cli.test.ts`
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: source adapter, storage manifest, SDS indexer/matcher, schema tables, and existing `r2`/`R2_BUCKET` configuration.
- Produces: a deterministic preview summary and an applied import batch with private R2 artifacts and review rows.

- [ ] **Step 1: Write the failing CLI contract test**

Assert the script:

- recognizes `--masterlist`, `--layout`, `--sds-root`, and `--apply`;
- defaults to dry-run;
- requires both expected source hashes;
- prints JSON counts for master-list rows, positions, file types, duplicates, candidate/mismatch/missing, and quantity conflicts;
- contains no status assignment to `approved`;
- uploads only under `chemical-safety/sources/` and `chemical-safety/imports/`;
- uses `upsert`/unique hashes so reruns are idempotent.

- [ ] **Step 2: Verify failure**

Run: `npx tsx scripts/chemical-safety-import-cli.test.ts`

Expected: FAIL because `scripts/import-chemical-safety.ts` does not exist.

- [ ] **Step 3: Implement explicit CLI parsing and dry-run summary**

Use this invocation contract:

```text
npx tsx scripts/import-chemical-safety.ts \
  --masterlist "<pdf>" --layout "<png>" --sds-root "<directory>" [--apply]
```

Load `.env.local` through `dotenv.config({ path: '.env.local' })`. Reject missing paths, unexpected source hashes, a master-list row count other than 25, a location count other than 13, or an SDS archive with zero PDFs. Dry-run performs no Supabase or R2 write and prints a single JSON summary with `mode: "dry-run"`.

- [ ] **Step 4: Implement apply mode with immutable batches and private blobs**

In apply mode:

1. create or reuse the master-list and layout source batches by `(source_kind, source_sha256)`;
2. upload the exact PDF/image to `chemical-safety/sources/<sha256>-<safe-name>` only when absent;
3. seed/update only normalized proposals in `chemical_import_rows`, not approved product/holding tables;
4. create one archive batch whose source hash is SHA-256 of sorted `relativePath:sha256` lines;
5. upload each unique PDF blob once to `chemical-safety/imports/<sha256>.pdf`;
6. store every source path in `chemical_sds_files.source_paths` and every archive entry in an import row;
7. associate candidate/mismatch/missing evidence with the 25 master-list proposals;
8. write import audit rows with counts but no local path in user-facing text.

Use batches of 100 database writes and fail the apply command if any write returns an error. Do not partially mark a batch `completed`; leave it `failed` with summary/error evidence.

- [ ] **Step 5: Run all focused tests**

Update `test:chemical-safety` to include the CLI test, then run:

```bash
npm run test:chemical-safety
```

Expected: all foundation/import tests pass.

- [ ] **Step 6: Apply the schema to the intended non-production database**

Run:

```bash
node scripts/run-migration.mjs scripts/chemical-safety-module.sql
```

Expected: `✅ Migration สำเร็จ`.

If the configured database is production, stop and obtain an explicit deployment confirmation before this step; database selection is not inferred from the source-file request.

- [ ] **Step 7: Run the exact dry-run and compare baseline counts**

Run in PowerShell:

```powershell
npx tsx scripts/import-chemical-safety.ts --masterlist 'C:\Users\User\Downloads\Unit Chemical Inventory List ห้องเก็บสารเคมี (1).pdf' --layout 'E:\ISO\ISO15190\safety\ห้องสาร\ผังสารเคมี.png' --sds-root 'C:\Users\User\Downloads\MSDS 2568'
```

Expected JSON includes `25` master-list rows, `13` positions, `521` PDF, `18` DOCX, `16` DOC, `1` HTML, `5` quantity conflicts, `13` plausible candidates, `7` mismatches, and `5` missing products. Any different count blocks apply until investigated.

- [ ] **Step 8: Apply the reviewed import and verify quarantine state**

Run the same command with `--apply` only after the dry-run matches. Query the new tables and assert:

- import batches are completed and rerunning produces no duplicate rows/blobs;
- there are 25 master-list proposal rows and 13 locations;
- no `chemical_sds_versions.status = 'approved'` exists;
- no QR token is active;
- every stored file has a source path and SHA-256.

- [ ] **Step 9: Document migration/import recovery and commit**

Document dry-run/apply, exact source hashes, idempotent reruns, the rule that imports remain non-public, and how a failed batch is inspected before rerun.

```bash
git add scripts/import-chemical-safety.ts scripts/chemical-safety-import-cli.test.ts README.md package.json
git commit -m "feat(chemical-safety): import chemical room source data"
```

---

### Task 6: Foundation regression gate

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: a clean handoff to the internal workflow plan with staged, auditable source data.

- [ ] **Step 1: Run the full foundation test gate**

Run each command separately:

```bash
npm run test:chemical-safety
npx tsc --noEmit
npm run build
```

Expected: every command exits 0. The build does not yet expose `/sds`.

- [ ] **Step 2: Verify source safety invariants**

Run read-only database queries confirming no approved SDS, no active public QR token, exactly one room code `chemical-prep`, 13 active locations, raw `B3, B4` provenance retained, normalized B3/B4 proposals split according to the storage image, and all five reported/calculated quantity conflicts visible.

- [ ] **Step 3: Commit any final foundation documentation correction**

```bash
git add README.md
git commit -m "docs(chemical-safety): document import foundation"
```
