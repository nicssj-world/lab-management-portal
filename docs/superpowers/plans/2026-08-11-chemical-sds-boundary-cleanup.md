# Chemical SDS Boundary Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แยก SDS ห้องสารเคมีออกจาก SDS แยกตามงานทั้งในข้อมูลเดิมและหน้าจอ โดย backfill เฉพาะความสัมพันธ์ที่พิสูจน์ได้ และไม่ลบไฟล์หรือเวอร์ชันเดิม

**Architecture:** คง `chemical_sds_versions` เป็นตาราง version กลาง แต่ให้ `source_holding_id` หรือ department link เป็นตัวกำหนดปลายทาง SDS อย่าง explicit. Legacy versions ที่ระบุไม่ได้จะถูกจัดเป็น ambiguous และไม่ถูกนำไปแสดงเป็น SDS ห้องสารเคมีจนกว่าจะผูกข้อมูล. หน้าทะเบียนจะเลือก version ตรงกับ holding เท่านั้น ส่วนคลัง SDS งานจะใช้ department archive/publications แยกต่างหาก.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase service-role scripts, Node `tsx`, Node `assert` tests

## Global Constraints

- ห้ามลบหรือเปลี่ยน `file_id`, status, `chemical_sds_files`, `chemical_department_sds` หรือ department links ใน cleanup
- cleanup script ต้อง dry-run เป็นค่าเริ่มต้น และ `--apply` ต้องหยุดเมื่อ invariant ไม่ผ่าน
- 8 ambiguous rows ต้องไม่ถูกเดาปลายทางหรือ backfill อัตโนมัติ
- หน้าใหม่/โค้ดใหม่ต้องอ่าน Next.js 16 docs ที่เกี่ยวข้องและใช้ async route APIs ตาม convention ของ repository
- ใช้ inline styles และ house components ตาม convention ของ chemical-safety module

---

### Task 1: Add a tested SDS classification and cleanup planner

**Files:**
- Create: `lib/chemical-safety/sds-cleanup.ts`
- Create: `lib/chemical-safety/sds-cleanup.test.ts`
- Create: `scripts/chemical-safety-sds-cleanup.ts`
- Modify: `package.json` (add `chemical-safety:cleanup-sds` script)

**Interfaces:**
- `buildSdsCleanupPlan(input): SdsCleanupPlan` consumes versions, holdings, department links, and products; produces deterministic room assignments, resolved counts, ambiguous rows, and invariant errors.
- `run` in `scripts/chemical-safety-sds-cleanup.ts` loads the same rows from Supabase, prints the plan in dry-run mode, and with `--apply` updates only planned `source_holding_id` values and writes `audit_log` rows.

- [x] **Step 1: Write the failing planner tests**

Add fixtures and assertions for these exact cases:

```ts
const plan = buildSdsCleanupPlan({
  versions: [
    { id: 'legacy-room', product_id: 'p-room', source_holding_id: null, status: 'approved' },
    { id: 'legacy-department', product_id: 'p-both', source_holding_id: null, status: 'draft' },
    { id: 'direct-department', product_id: 'p-dept', source_holding_id: 'h-dept', status: 'draft' },
  ],
  holdings: [
    { id: 'h-room', product_id: 'p-room', storage_scope: 'room' },
    { id: 'h-both-room', product_id: 'p-both', storage_scope: 'room' },
    { id: 'h-both-dept', product_id: 'p-both', storage_scope: 'department' },
    { id: 'h-dept', product_id: 'p-dept', storage_scope: 'department' },
  ],
  departmentLinks: [],
  products: [
    { id: 'p-room', canonical_name: 'Room chemical' },
    { id: 'p-both', canonical_name: 'Shared product' },
    { id: 'p-dept', canonical_name: 'Department product' },
  ],
})

assert.deepEqual(plan.assignments, [{ versionId: 'legacy-room', holdingId: 'h-room', reason: 'unique_room_holding' }])
assert.deepEqual(plan.ambiguous.map(row => row.versionId), ['legacy-department'])
assert.equal(plan.resolved.department, 1)
assert.equal(plan.errors.length, 0)
```

Also test that a department-linked version is resolved as department even when the product has a room holding, and that a source holding with a mismatched product creates an invariant error.

- [x] **Step 2: Run the planner test and verify it fails for the missing module**

Run: `npx tsx lib/chemical-safety/sds-cleanup.test.ts`

Expected: FAIL because `./sds-cleanup` does not exist yet.

- [x] **Step 3: Implement the minimal pure planner**

Implement `buildSdsCleanupPlan` with these rules:

```ts
if (version.source_holding_id) resolve the holding and validate product_id
else if the version has one or more department links resolve as department
else if exactly one room holding exists and no department holding exists plan a room assignment
else add an ambiguous row for both-scope, zero-holding, or multi-room cases
```

The planner must preserve the original status and file metadata in its output, but it must never include an assignment for a department holding.

- [x] **Step 4: Run the planner test and verify it passes**

Run: `npx tsx lib/chemical-safety/sds-cleanup.test.ts`

Expected: PASS.

- [x] **Step 5: Implement the dry-run/apply script**

Load only the required columns from `chemical_sds_versions`, `chemical_inventory_holdings`, `chemical_department_chemical_links`, and `chemical_products`. Print total counts, planned assignments, resolved room/department counts, ambiguous rows, and errors. With `--apply`, for each assignment:

```ts
await supabase
  .from('chemical_sds_versions')
  .update({ source_holding_id: assignment.holdingId })
  .eq('id', assignment.versionId)
  .is('source_holding_id', null)
  .select('id, product_id, source_holding_id, status, file_id')
  .single()
```

Then insert an `audit_log` row with action `chemical_safety.sds.cleanup_assign_room_holding`, `target` equal to the version ID, and JSON `before`, `after`, `reason`, and `script` fields. Abort before any write if `plan.errors` is non-empty.

- [x] **Step 6: Add the package command and run dry-run**

Add:

```json
"chemical-safety:cleanup-sds": "tsx scripts/chemical-safety-sds-cleanup.ts"
```

Run: `npm run chemical-safety:cleanup-sds`

Expected against the current database: 20 planned room assignments, 106 resolved department versions, 8 ambiguous versions, and no invariant errors.

### Task 2: Make room visibility and registry workflow holding-scoped

**Files:**
- Modify: `lib/chemical-safety/sds-visibility.ts`
- Modify: `lib/chemical-safety/sds-visibility.test.ts`
- Modify: `lib/chemical-safety/repository.ts:252-259`
- Modify: `components/chemical-safety/RegistrySdsWorkflowModal.tsx:51-61`

**Interfaces:**
- `roomChemicalProductIds` returns only products whose known holdings have room scope and no department scope for legacy fallback.
- `ChemicalRegistryRow` status selection and `RegistrySdsWorkflowModal` version selection use only versions whose `source_holding_id` equals the current holding.

- [x] **Step 1: Change the visibility test to fail closed for both-scope products**

Change the existing fixture so `legacy-room-version` and `legacy-department-version` use a product with both a room and department holding, then assert neither is returned without an explicit source or department link. Add a room-only legacy product fixture and assert its version remains visible. Add static assertions that the registry repository and modal use holding-scoped selection.

- [x] **Step 2: Run the visibility test and verify the old fallback fails**

Run: `npx tsx lib/chemical-safety/sds-visibility.test.ts`

Expected: FAIL because the current product fallback includes an unlinked version whenever any room holding exists, and the modal/repository still use product-wide approved fallback.

- [x] **Step 3: Implement fail-closed legacy visibility**

Build a product-to-scope map and let `roomChemicalProductIds` include only products whose scope set is exactly `{room}`. Keep direct room source holdings visible and keep department-linked versions excluded. Do not change direct source validation.

- [x] **Step 4: Scope registry selection to the current holding**

In `listChemicalRegistryWithSource`, compute `holdingVersions` first and derive `approved`, `draft`, GHS, and `sdsStatus` from that collection. In `RegistrySdsWorkflowModal`, filter `productVersions` by both product ID and `row.holdingId` before choosing current/approved versions. No product-wide approved version may be used as a fallback.

- [x] **Step 5: Run visibility and chemical-safety tests**

Run: `npx tsx lib/chemical-safety/sds-visibility.test.ts` then `npm run test:chemical-safety`.

Expected: PASS with the room panel and registry workflow contract tests green.

### Task 3: Apply only the deterministic data cleanup

**Files:**
- No new production files; use `scripts/chemical-safety-sds-cleanup.ts`
- Database rows: `chemical_sds_versions.source_holding_id` for the planner's 20 assignments only

- [x] **Step 1: Re-run dry-run after code changes**

Run: `npm run chemical-safety:cleanup-sds`

Expected: 20 assignments, 8 ambiguous rows, 0 errors. Stop if the counts differ.

- [x] **Step 2: Apply the deterministic assignments**

Run: `npm run chemical-safety:cleanup-sds -- --apply`

Expected: 20 rows updated, no file IDs or statuses changed, and 20 audit rows written.

- [x] **Step 3: Verify the database postcondition read-only**

Run the cleanup script without `--apply` again.

Expected: 0 planned assignments, 20 room versions resolved by direct source holding, 106 department versions resolved by links/direct department holding, 8 ambiguous versions still reported, and 0 errors.

### Task 4: Full verification and handoff

**Files:**
- No additional files

- [x] **Step 1: Run the complete chemical-safety suite**

Run: `npm run test:chemical-safety`

Expected: exit code 0.

- [x] **Step 2: Run TypeScript verification**

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [x] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js compilation, type checking, and static generation complete with exit code 0.

- [x] **Step 4: Inspect the final diff and report unresolved data**

Run: `git diff --check` and `git status --short`. Report the 8 ambiguous SDS by product name and state that no file/version was deleted.
