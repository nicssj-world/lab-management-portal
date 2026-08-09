# Department SDS Existing Registry Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ผู้ดูแลผูกไฟล์ SDS แยกตามงานกับ holding ที่มีอยู่ในทะเบียนได้ โดยไม่สร้าง product, unit-product หรือ holding ซ้ำ

**Architecture:** Repository จะคืน candidate holdings ทุกตัวที่จับคู่ชื่อได้และบอก availability; UI เปิด modal ให้ยืนยันหรือเลือก candidate; API ตรวจสิทธิ์และเรียก PostgreSQL RPC แบบ atomic ซึ่ง reuse/create SDS version แล้วสร้าง link กับ audit log เท่านั้น

**Tech Stack:** Next.js 16.2.6 App Router, React/TypeScript, Zod, Supabase JS, PostgreSQL PL/pgSQL, Node assert contract tests

## Global Constraints

- ทำบน branch `main` ตามคำสั่งผู้ใช้ ไม่สร้าง worktree
- ห้ามสร้าง `chemical_products`, `chemical_unit_products` หรือ `chemical_inventory_holdings` ใน workflow นี้
- ห้ามย้ายหรือยกเลิก link ที่มีอยู่ และห้ามเผยแพร่ SDS version อัตโนมัติ
- RPC ใช้ `SECURITY INVOKER`, schema-qualified relations, revoke จาก `PUBLIC`, `anon`, `authenticated` และ grant เฉพาะ `service_role`
- รักษาการแก้ไขเดิมใน dirty worktree; ไม่ commit implementation เพราะ `SdsManagementClient.tsx` มีการแก้ไขที่ซ้อนกับงานอื่น

---

### Task 1: คืน candidate holdings ครบและไม่เลือกกรณีกำกวมแทนผู้ใช้

**Files:**
- Modify: `lib/chemical-safety/department-registry.ts`
- Modify: `lib/chemical-safety/department-registry.test.ts`
- Modify: `lib/chemical-safety/department-repository.ts`
- Modify: `lib/chemical-safety/repository-department.test.ts`

**Interfaces:**
- Produces: `findRegisteredDepartmentChemicals(sdsNames, unitId, registered): RegisteredDepartmentChemical[]`
- Produces: `DepartmentSdsRegistryCandidateDTO` and `DepartmentSdsRegistryLinkDTO.candidates`
- Candidate fields: `productId`, `productName`, `holdingId`, `lotNumber`, `packageValue`, `packageUnit`, `currentContainerCount`, `availableToLink`

- [ ] **Step 1: Write the failing matcher test**

เพิ่ม candidates ชื่อเดียวกันสอง holding แล้ว assert ว่า function ใหม่คืนทั้งสองตัวตามลำดับ deterministic และ `findRegisteredDepartmentChemical` compatibility wrapper คืนตัวแรก:

```ts
const matches = registryModule.findRegisteredDepartmentChemicals(
  ['Liquichek Urinalysis Control (Thai)'],
  'unit-biomolecular',
  registered,
)
assert.deepEqual(matches.map((item: any) => item.holdingId), [
  'holding-liquichek-level-1',
  'holding-liquichek-level-2',
])
```

- [ ] **Step 2: Run the matcher test and verify RED**

Run: `npx tsx lib/chemical-safety/department-registry.test.ts`

Expected: FAIL เพราะ `findRegisteredDepartmentChemicals` ยังไม่มี

- [ ] **Step 3: Implement all-match helper**

แยกการ sort เดิมออกเป็น function ที่คืน candidates ทั้งหมด โดย dedupe `holdingId`; ให้ wrapper เดิมเรียก `[0] ?? null` เพื่อไม่ทำลาย callers เดิม

```ts
export function findRegisteredDepartmentChemicals(
  sdsNames: readonly string[],
  unitId: string | null,
  registered: readonly RegisteredDepartmentChemical[],
): RegisteredDepartmentChemical[] {
  if (!unitId) return []
  return matches
    .sort(compareMatch)
    .map(item => item.candidate)
    .filter((item, index, all) => all.findIndex(other => other.holdingId === item.holdingId) === index)
}
```

- [ ] **Step 4: Run matcher test and verify GREEN**

Run: `npx tsx lib/chemical-safety/department-registry.test.ts`

Expected: exit 0

- [ ] **Step 5: Write failing repository contract**

เพิ่ม assertions ว่า repository query holdings มีรายละเอียดล็อต/ปริมาณ, query links มี `holding_id`, DTO มี `candidates`, และ availability เทียบกับ holding IDs ที่ถูก link แล้ว

```ts
assert.match(source, /lot_number, package_value, package_unit, current_container_count/)
assert.match(source, /candidates:/)
assert.match(source, /availableToLink:/)
```

- [ ] **Step 6: Run repository contract and verify RED**

Run: `npx tsx lib/chemical-safety/repository-department.test.ts`

Expected: FAIL ที่ candidate DTO/query ยังไม่มี

- [ ] **Step 7: Extend repository DTO and data assembly**

เพิ่ม fields ใน `RegisteredDepartmentChemical`, โหลด holding details, สร้าง `linkedHoldingIds`, เรียก all-match helper และคืน candidates ทุกตัว สำหรับ `registered` ให้ top-level product/holding เป็นค่าเมื่อมี candidate เดียวเท่านั้น; ถ้ามีหลายตัวให้ top-level IDs เป็น `null`

- [ ] **Step 8: Run repository contract and verify GREEN**

Run: `npx tsx lib/chemical-safety/repository-department.test.ts`

Expected: exit 0

---

### Task 2: Atomic PostgreSQL RPC สำหรับผูก holding เดิม

**Files:**
- Modify: `supabase/migrations/20260809074220_link_department_sds_existing_holding.sql`
- Modify: `scripts/chemical-safety-department-registry.test.ts`

**Interfaces:**
- Produces RPC: `public.link_department_sds_to_existing_holding(p_department_sds_id uuid, p_holding_id uuid, p_actor_id uuid) returns uuid`
- Errors: `department_sds_not_found`, `department_sds_file_not_found`, `department_sds_unit_not_found`, `department_sds_already_linked`, `department_holding_not_found`, `department_holding_wrong_scope`, `department_holding_wrong_unit`, `department_holding_inactive`, `department_holding_already_linked`

- [ ] **Step 1: Write failing migration contract**

อ่าน migration path ใหม่และ assert signature, guards, SDS version reuse/insert, link insert, audit insert, privilege statements และ assert ว่า migration ไม่มี `INSERT INTO public.chemical_products`, `chemical_unit_products` หรือ `chemical_inventory_holdings`

```ts
const existingLinkMigration = read('supabase/migrations/20260809074220_link_department_sds_existing_holding.sql')
assert.match(existingLinkMigration, /CREATE OR REPLACE FUNCTION public\.link_department_sds_to_existing_holding/i)
assert.match(existingLinkMigration, /SECURITY INVOKER SET search_path = ''/i)
assert.doesNotMatch(existingLinkMigration, /INSERT INTO public\.chemical_inventory_holdings/i)
```

- [ ] **Step 2: Run migration contract and verify RED**

Run: `npx tsx scripts/chemical-safety-department-registry.test.ts`

Expected: FAIL เพราะ migration ยังว่าง

- [ ] **Step 3: Implement RPC in the CLI-created migration**

Function โหลด source SDS + unit, โหลด holding + product/unit-product, ตรวจ link conflicts, reuse/create `chemical_sds_versions`, insert link และ audit ใน transaction ของ function แล้วคืน link UUID

```sql
CREATE OR REPLACE FUNCTION public.link_department_sds_to_existing_holding(
  p_department_sds_id uuid,
  p_holding_id uuid,
  p_actor_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  source_file_id uuid;
  source_department_code text;
  source_unit_id uuid;
  holding_product_id uuid;
  holding_unit_id uuid;
  holding_storage_scope text;
  holding_unit_product_active boolean;
  holding_product_status text;
  sds_version_id uuid;
  link_id uuid;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;

  SELECT entry.file_id, entry.department_code
  INTO source_file_id, source_department_code
  FROM public.chemical_department_sds AS entry
  WHERE entry.id = p_department_sds_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'department_sds_not_found'; END IF;
  IF source_file_id IS NULL THEN RAISE EXCEPTION 'department_sds_file_not_found'; END IF;

  SELECT unit.id INTO source_unit_id
  FROM public.chemical_sds_departments AS department
  JOIN public.chemical_units AS unit
    ON unit.name_th = department.department AND unit.active = true
  WHERE department.code = source_department_code;
  IF source_unit_id IS NULL THEN RAISE EXCEPTION 'department_sds_unit_not_found'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.chemical_department_chemical_links
    WHERE department_sds_id = p_department_sds_id
  ) THEN RAISE EXCEPTION 'department_sds_already_linked'; END IF;

  SELECT holding.product_id, holding.unit_id, holding.storage_scope,
    unit_product.active, product.lifecycle_status
  INTO holding_product_id, holding_unit_id, holding_storage_scope,
    holding_unit_product_active, holding_product_status
  FROM public.chemical_inventory_holdings AS holding
  JOIN public.chemical_products AS product ON product.id = holding.product_id
  LEFT JOIN public.chemical_unit_products AS unit_product
    ON unit_product.product_id = holding.product_id
   AND unit_product.unit_id = holding.unit_id
  WHERE holding.id = p_holding_id
  FOR UPDATE OF holding;
  IF NOT FOUND THEN RAISE EXCEPTION 'department_holding_not_found'; END IF;
  IF holding_storage_scope <> 'department' THEN RAISE EXCEPTION 'department_holding_wrong_scope'; END IF;
  IF holding_unit_id <> source_unit_id THEN RAISE EXCEPTION 'department_holding_wrong_unit'; END IF;
  IF holding_unit_product_active IS DISTINCT FROM true OR holding_product_status <> 'active'
    THEN RAISE EXCEPTION 'department_holding_inactive';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.chemical_department_chemical_links
    WHERE holding_id = p_holding_id
  ) THEN RAISE EXCEPTION 'department_holding_already_linked'; END IF;

  SELECT version.id INTO sds_version_id
  FROM public.chemical_sds_versions AS version
  WHERE version.product_id = holding_product_id AND version.file_id = source_file_id
  ORDER BY version.created_at DESC
  LIMIT 1;
  IF sds_version_id IS NULL THEN
    INSERT INTO public.chemical_sds_versions (
      product_id, file_id, language, status, created_by
    ) VALUES (
      holding_product_id, source_file_id, 'th', 'draft', p_actor_id
    ) RETURNING id INTO sds_version_id;
  END IF;

  INSERT INTO public.chemical_department_chemical_links (
    department_sds_id, product_id, holding_id, sds_version_id, linked_by
  ) VALUES (
    p_department_sds_id, holding_product_id, p_holding_id, sds_version_id, p_actor_id
  ) RETURNING id INTO link_id;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES (
    'chemical_safety.department_sds.link_existing', p_actor_id, link_id::text,
    jsonb_build_object(
      'department_sds_id', p_department_sds_id,
      'product_id', holding_product_id,
      'holding_id', p_holding_id,
      'sds_version_id', sds_version_id
    )::text
  );
  RETURN link_id;
END;
$$;

REVOKE ALL ON FUNCTION public.link_department_sds_to_existing_holding(uuid,uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_department_sds_to_existing_holding(uuid,uuid,uuid)
  TO service_role;
```

- [ ] **Step 4: Run migration contract and verify GREEN**

Run: `npx tsx scripts/chemical-safety-department-registry.test.ts`

Expected: `chemical-safety department registry contract: ok`

---

### Task 3: Server-only link-existing endpoint

**Files:**
- Create: `app/api/admin/chemical-safety/department-sds/[code]/link-existing/route.ts`
- Modify: `scripts/chemical-safety-department-registry.test.ts`

**Interfaces:**
- Consumes RPC from Task 2
- Request: `{ holdingId: string }`
- Response: `{ data: { linkId: string } }`

- [ ] **Step 1: Write failing route contract**

Assert route exists, uses `parseJson` with UUID schema, resolves the SDS department/unit, calls `requireChemicalCustodian`, invokes `link_department_sds_to_existing_holding`, and maps known database errors without direct table inserts

```ts
const linkRoute = read('app/api/admin/chemical-safety/department-sds/[code]/link-existing/route.ts')
assert.match(linkRoute, /holdingId:\s*z\.string\(\)\.uuid\(\)/)
assert.match(linkRoute, /requireChemicalCustodian/)
assert.match(linkRoute, /link_department_sds_to_existing_holding/)
assert.doesNotMatch(linkRoute, /\.from\('chemical_department_chemical_links'\)\.insert/)
```

- [ ] **Step 2: Run route contract and verify RED**

Run: `npx tsx scripts/chemical-safety-department-registry.test.ts`

Expected: FAIL เพราะ route ยังไม่มี

- [ ] **Step 3: Implement route**

ใช้ `z.object({ holdingId: z.string().uuid() })`, `parseJson`, server-side department-to-unit resolution และ guard ก่อน RPC

```ts
const linked = await supabaseAdmin.rpc('link_department_sds_to_existing_holding', {
  p_department_sds_id: departmentSdsId,
  p_holding_id: input.data.holdingId,
  p_actor_id: guard.actor.id,
})
```

Map known error messages เป็น status ตาม design; errors อื่นส่งผ่าน `unexpectedError`

- [ ] **Step 4: Run route contract and verify GREEN**

Run: `npx tsx scripts/chemical-safety-department-registry.test.ts`

Expected: exit 0

---

### Task 4: Modal เลือก candidate และปุ่มผูกไฟล์

**Files:**
- Create: `components/chemical-safety/DepartmentSdsLinkModal.tsx`
- Modify: `components/chemical-safety/SdsManagementClient.tsx`
- Modify: `scripts/chemical-safety-ui.test.ts`

**Interfaces:**
- Consumes `DepartmentSdsRegistryCandidateDTO[]`
- Modal props: `{ file, departmentName, onClose, onLinked }`
- Calls `POST /api/admin/chemical-safety/department-sds/${file.id}/link-existing`

- [ ] **Step 1: Write failing UI contract**

Assert modal exists, lists `file.registryLink.candidates`, requires a selected available holding, calls endpoint, has `role="dialog"`/`aria-modal="true"`, and SdsManagementClient shows the action only for `registered`

```ts
assert.ok(existsSync(join(COMPONENT_DIR, 'DepartmentSdsLinkModal.tsx')))
assert.match(sdsSource, /registryLink\.status === 'registered'[\s\S]{0,240}ผูกไฟล์กับทะเบียน/)
assert.match(linkModalSource, /link-existing/)
assert.match(linkModalSource, /availableToLink/)
```

- [ ] **Step 2: Run UI contract and verify RED**

Run: `npx tsx scripts/chemical-safety-ui.test.ts`

Expected: FAIL เพราะ modal/action ยังไม่มี

- [ ] **Step 3: Implement focused link modal**

Modal แสดงชื่อไฟล์, radio candidates พร้อม lot/ปริมาณ, disable candidates ที่ถูกใช้แล้ว, preselect เมื่อมี available candidate เดียว, submit JSON `{ holdingId }`, แสดง server error และปิดด้วยปุ่ม X เท่านั้น

- [ ] **Step 4: Wire action into SdsManagementClient**

เพิ่ม state `linking`, ปุ่ม `ผูกไฟล์กับทะเบียน` เฉพาะ `canRegister && status === 'registered'`, เปิด modal และเรียก `onDone('ผูกไฟล์ SDS กับทะเบียนแล้ว')` หลังสำเร็จเพื่อ refresh server data

- [ ] **Step 5: Run UI contract and verify GREEN**

Run: `npx tsx scripts/chemical-safety-ui.test.ts`

Expected: `chemical-safety ui: ok`

---

### Task 5: Full verification and live-safe database checks

**Files:**
- Verify all files above; no new production files

**Interfaces:**
- Verifies migration/API/UI as one workflow

- [ ] **Step 1: Run all chemical-safety tests**

Run: `npm run test:chemical-safety`

Expected: all scripts exit 0

- [ ] **Step 2: Run TypeScript and whitespace verification**

Run in parallel: `npx tsc --noEmit` and `git diff --check`

Expected: both exit 0; line-ending warnings are informational only

- [ ] **Step 3: Validate migration syntax without mutating remote data**

Run: `npx supabase migration list --local`

Expected: CLI parses local migration history; if local stack is unavailable, report that limitation and rely on SQL contract plus remote read-only schema checks

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: Next.js compile, TypeScript, and static page generation all succeed

- [ ] **Step 5: Review final diff**

Run: `git diff --stat` and `git status --short`

Expected: only planned files plus pre-existing unrelated dirty files; do not revert or commit unrelated changes
