# Digital Lab Map Staff and Personnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the protected map with database-backed space metadata and personnel assignments, while deliberately leaving the existing equipment registry unchanged and disconnected from the map.

**Architecture:** Keep geometry and approved route presets in the typed repository manifest. Seed stable space/zone codes into Postgres only to support editable labels, work-unit relationships, map versions, and personnel assignments. A Server Component builds a permission-filtered DTO; the Client Component never receives personnel fields when the viewer lacks `บุคลากร:view`.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript 5, Supabase/Postgres, Zod, existing `Permissions` and `audit_log` patterns, Node `assert` + `tsx` contract tests.

## Global Constraints

- Requires the Foundation Plan.
- Read installed Next.js guidance under `node_modules/next/dist/docs/` before changing Server/Client boundaries or Route Handlers.
- The map represents a person's primary/responsible work area, never live presence or tracking.
- Public routes and DTOs must never import or serialize the personnel assignment query.
- Personnel read/edit gates must use the existing `บุคลากร` resource. UI hiding is not authorization.
- Each assignment targets exactly one `space_id` or one `zone_id`.
- The equipment registry is explicitly outside this plan: do not add columns to `equipment`, change its APIs/forms, or add an equipment map mode.
- Keep geometry edits in Git; no drag-and-drop map editor.

---

### Task 1: Add idempotent map metadata and personnel-assignment schema

**Files:**
- Create: `scripts/lab-map-module.sql`
- Create: `scripts/lab-map-schema.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `lab_map_spaces`, `lab_map_zones`, `lab_map_zone_spaces`, `lab_map_space_work_units`, `lab_map_access_points`, `lab_map_stations`, `lab_map_versions`, and `lab_map_person_assignments`.
- Consumes: stable codes from `lib/lab-map/manifest.ts` and profile IDs from `profiles`.

- [ ] **Step 1: Write a failing SQL contract test**

Create `scripts/lab-map-schema.test.ts` to read the migration and assert all required tables, unique constraints, foreign keys, row-level security statements, and the exact-one-target check. Also assert the migration contains no `alter table equipment`, `space_id` addition to equipment, or equipment map relation.

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync('scripts/lab-map-module.sql', 'utf8')
for (const table of [
  'lab_map_spaces', 'lab_map_zones', 'lab_map_zone_spaces',
  'lab_map_space_work_units', 'lab_map_access_points', 'lab_map_stations',
  'lab_map_versions', 'lab_map_person_assignments',
]) assert.match(sql, new RegExp(`create table if not exists ${table}`))

assert.match(sql, /num_nonnulls\(space_id, zone_id\) = 1/)
assert.doesNotMatch(sql, /alter table\s+(?:public\.)?equipment/i)
console.log('lab map schema contract passed')
```

- [ ] **Step 2: Verify the contract fails**

Run: `npx tsx scripts/lab-map-schema.test.ts`

Expected: FAIL because the SQL file does not exist.

- [ ] **Step 3: Write the migration**

Use UUID primary keys and stable unique `code` columns. Required constraints:

```sql
create table if not exists lab_map_person_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  space_id uuid references lab_map_spaces(id) on delete cascade,
  zone_id uuid references lab_map_zones(id) on delete cascade,
  assignment_type text not null check (assignment_type in ('primary', 'responsible')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lab_map_person_assignment_one_target check (num_nonnulls(space_id, zone_id) = 1)
);
```

Add partial unique indexes so one profile cannot receive the same type/space or type/zone twice. Enable RLS on every new table; do not add anonymous grants. Service-role server code remains the only writer. Seed space, zone, access-point, and station codes with `insert ... on conflict (code) do update` without overwriting approval history.

- [ ] **Step 4: Add the schema test command and run it**

Add `test:lab-map-schema` to `package.json` and run `npm run test:lab-map-schema`.

Expected: PASS.

- [ ] **Step 5: Commit the schema**

```bash
git add scripts/lab-map-module.sql scripts/lab-map-schema.test.ts package.json
git commit -m "feat(lab-map): add spatial personnel schema"
```

---

### Task 2: Build permission-filtered staff map queries

**Files:**
- Create: `lib/lab-map/schemas.ts`
- Create: `lib/lab-map/server.ts`
- Create: `lib/lab-map/server.test.ts`
- Modify: `lib/lab-map/types.ts`

**Interfaces:**
- Produces: `StaffLabMapDTO`, `StaffMapPersonDTO`, `getStaffLabMapDTO({ permissions })`, and `canViewMapPersonnel(permissions)`.
- Consumes: `getStaffRoster()`, spatial tables, full manifest, and existing `Permissions`.

- [ ] **Step 1: Write failing DTO and permission tests**

Test three cases with injected repositories: geometry-only permission, `บุคลากร:view`, and `บุคลากร:edit`. Geometry-only output must omit the `people` property entirely rather than returning a hidden list. Personnel DTOs may contain only `profileId`, `name`, `department`, `assignmentType`, `spaceCode`, and `zoneCode`; do not reuse the full `Profile` object.

- [ ] **Step 2: Run the test and confirm failure**

Run: `npx tsx lib/lab-map/server.test.ts`

Expected: FAIL because `server.ts` does not exist.

- [ ] **Step 3: Define Zod input schemas and serializable DTOs**

Add `personAssignmentInputSchema` with UUID `profileId`, enum `assignmentType`, nullable `spaceCode`/`zoneCode`, and a refinement requiring exactly one target. Add DTO types to `types.ts`; use `string` timestamps and plain arrays only.

- [ ] **Step 4: Implement the server-only query**

Start `lib/lab-map/server.ts` with `import 'server-only'`. Resolve manifest codes to active database rows and fail with a clear server error if seeded codes drift. Query the minimal profile projection `id,name,department` only when permission level is `view` or `edit`. Return `canEditPersonnelAssignments` separately for the UI.

- [ ] **Step 5: Pass tests and commit**

Run: `npx tsx lib/lab-map/server.test.ts`

Expected: PASS for omission, minimal-field, target, and drift cases.

```bash
git add lib/lab-map/types.ts lib/lab-map/schemas.ts lib/lab-map/server.ts lib/lab-map/server.test.ts
git commit -m "feat(lab-map): build permission-filtered staff dto"
```

---

### Task 3: Add audited personnel assignment APIs

**Files:**
- Create: `app/api/admin/lab-map/person-assignments/route.ts`
- Create: `app/api/admin/lab-map/person-assignments/[id]/route.ts`
- Create: `scripts/lab-map-personnel-api.test.ts`
- Modify: `app/(protected)/staff/activity/ActivityClient.tsx`

**Interfaces:**
- `POST /api/admin/lab-map/person-assignments`: create one assignment.
- `PATCH /api/admin/lab-map/person-assignments/[id]`: replace assignment type/target.
- `DELETE /api/admin/lab-map/person-assignments/[id]`: remove assignment.
- All writes require `บุคลากร:edit` and write `lab_map.person_assignment.create|update|delete` audit actions.

- [ ] **Step 1: Write failing route contract tests**

Assert each handler authenticates, resolves role permissions server-side, validates with `personAssignmentInputSchema`, confirms the profile is active, confirms the target code is active and present in the manifest, and writes an audit record containing old/new target codes without sensitive profile fields.

- [ ] **Step 2: Confirm failure**

Run: `npx tsx scripts/lab-map-personnel-api.test.ts`

Expected: FAIL because the Route Handlers do not exist.

- [ ] **Step 3: Implement POST**

Follow existing personnel Route Handler authentication/error conventions. Resolve only one target, insert with `.select('id,profile_id,space_id,zone_id,assignment_type,created_at,updated_at').single()`, and await the audit insert so a failed audit does not silently report a fully successful administrative operation. Return `400`, `401`, `403`, `404`, or `409` as appropriate.

- [ ] **Step 4: Implement PATCH and DELETE**

Read the current assignment first for audit details and ownership checks. Use a single update/delete conditioned on `id`; preserve `created_at`. Reject a target absent from the manifest even if a stale database row exists.

- [ ] **Step 5: Add Thai activity labels and pass tests**

Map the three action names in `ActivityClient.tsx` to concise Thai labels. Run:

```bash
npx tsx scripts/lab-map-personnel-api.test.ts
npm run test:security
```

Expected: all pass.

- [ ] **Step 6: Commit the API**

```bash
git add -- "app/api/admin/lab-map/person-assignments/route.ts" ':(literal)app/api/admin/lab-map/person-assignments/[id]/route.ts' "app/(protected)/staff/activity/ActivityClient.tsx" scripts/lab-map-personnel-api.test.ts
git commit -m "feat(lab-map): manage audited personnel assignments"
```

---

### Task 4: Complete staff search, filters, and personnel detail panel

**Files:**
- Create: `components/lab-map/LabMapStaffClient.tsx`
- Create: `components/lab-map/LabMapPersonnelPanel.tsx`
- Create: `components/lab-map/LabMapAssignmentForm.tsx`
- Create: `scripts/lab-map-staff-ui.test.ts`
- Modify: `app/(protected)/staff/lab-map/page.tsx`
- Modify: `components/lab-map/LabMapCanvas.tsx`
- Modify: `components/lab-map/LabMapShell.tsx`

**Interfaces:**
- Consumes: `StaffLabMapDTO` from the Server Component.
- Produces: modes `overview`, `infection`, `safety`, and permission-gated `personnel`.

- [ ] **Step 1: Write the failing UI contract test**

Assert the staff page calls the server DTO builder, available modes exclude `equipment`, search covers space/zone/work-unit names, the personnel tab renders only when `people` exists, and edit controls require `canEditPersonnelAssignments`.

- [ ] **Step 2: Verify failure**

Run: `npx tsx scripts/lab-map-staff-ui.test.ts`

Expected: FAIL because the staff client does not exist.

- [ ] **Step 3: Implement staff interactions**

Use one selected-space/zone state shared by the map and detail panel. Search results must be keyboard navigable and identify whether the result is a room, zone, work unit, or person. Selecting Central Lab supports overall, left, and right zone views; selecting storage highlights its three physical spaces. Safety mode displays scan points, PPE, exits 3A/3B/3C, approved presets, and the permanently locked door.

- [ ] **Step 4: Implement personnel viewing and editing**

The panel explains “พื้นที่หลัก/พื้นที่รับผิดชอบ — ไม่ใช่ตำแหน่งปัจจุบัน”. The assignment form uses ordinary selects, not drag-and-drop. Refresh the Server Component data after successful mutations and preserve the selected target where possible. Provide an “ยังไม่ได้กำหนดพื้นที่” list from active profiles without assignments.

- [ ] **Step 5: Pass UI, accessibility, and build gates**

Run each command separately:

```bash
npx tsx scripts/lab-map-staff-ui.test.ts
npx tsx scripts/lab-map-ui.test.ts
npm run build
```

Expected: tests and build pass. Manually verify keyboard search, focus return after the mobile sheet closes, and that a user without personnel permission receives no personnel data in the RSC payload.

- [ ] **Step 6: Commit the staff experience**

```bash
git add -- "app/(protected)/staff/lab-map/page.tsx" components/lab-map/LabMapStaffClient.tsx components/lab-map/LabMapPersonnelPanel.tsx components/lab-map/LabMapAssignmentForm.tsx components/lab-map/LabMapCanvas.tsx components/lab-map/LabMapShell.tsx scripts/lab-map-staff-ui.test.ts
git commit -m "feat(lab-map): add staff personnel view"
```

---

### Task 5: Document migration and regression boundaries

**Files:**
- Modify: `README.md`
- Modify: `scripts/lab-map-domain.test.ts`

- [ ] **Step 1: Add explicit equipment exclusion regression**

Extend the domain/UI contract to assert `MapMode` and mode controls contain no `equipment` value and the lab-map SQL does not modify the equipment registry.

- [ ] **Step 2: Document deployment order**

Document: deploy Foundation, apply `scripts/lab-map-module.sql`, validate seeded codes, deploy staff/personnel UI, then assign people. State that the map feature makes no change to the equipment registry.

- [ ] **Step 3: Run the complete gate**

Run each command separately:

```bash
npm run test:lab-map
npm run test:lab-map-schema
npx tsx lib/lab-map/server.test.ts
npx tsx scripts/lab-map-personnel-api.test.ts
npx tsx scripts/lab-map-staff-ui.test.ts
npm run test:security
npm run build
```

Expected: all pass.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md scripts/lab-map-domain.test.ts
git commit -m "docs(lab-map): document personnel rollout boundary"
```
