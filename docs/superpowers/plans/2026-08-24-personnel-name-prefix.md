# Personnel Name Prefix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มคำนำหน้าชื่อ `นาย`, `น.ส.`, `นาง` แบบ nullable ใน personnel และ user management โดยแสดงชื่อเป็น `นางสมหญิง ใจดี` และไม่แก้ค่า `profiles.name` เดิม

**Architecture:** เก็บ `name_prefix` เป็นคอลัมน์แยกใน `profiles` พร้อม database check constraint และใช้ `NAME_PREFIX_OPTIONS`/`formatProfileName` จากโมดูลชื่อกลางเป็น source of truth เดียวกันทั้ง validator และ UI ฟอร์ม personnel กับ user management จะส่งค่าผ่าน API/service ที่มีอยู่แล้ว ส่วนหน้ารายการจะประกอบชื่อที่ UI boundary โดยไม่เปลี่ยนชื่อ raw ในฐานข้อมูล

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Supabase/Postgres, `tsx` test scripts, inline-style React UI

## Global Constraints

- รับเฉพาะ `นาย`, `น.ส.`, `นาง` หรือ `NULL`; dropdown แสดง `— ไม่ระบุ —` สำหรับค่าว่าง
- ต้องไม่มีช่องว่างระหว่างคำนำหน้าชื่อกับชื่อ เช่น `นางสมหญิง ใจดี`
- เก็บ `name` เป็นชื่อ-นามสกุลเดิมโดยไม่รวม prefix และไม่ backfill เดาจากข้อมูลเดิม
- ไม่เปลี่ยนรูปแบบไฟล์นำเข้าผู้ใช้แบบ bulk ในงานนี้
- ใช้ UI components และ inline styles ตาม convention เดิม ไม่ติดตั้ง library เพิ่ม
- ทำงานบน branch `main` ที่ผู้ใช้ระบุ และแก้เฉพาะไฟล์ในขอบเขต feature
- เขียน test ก่อน production code และต้องเห็น test fail ด้วยสาเหตุจาก feature ที่ยังไม่มี

---

## File Map

### Shared domain and validation

- Create: `lib/personnel/name.ts` — `NAME_PREFIX_OPTIONS`, `NamePrefix`, `formatProfileName`
- Create: `lib/personnel/name.test.ts` — formatter and option tests
- Create: `lib/validations/name-prefix.ts` — shared nullable/empty-string-normalizing Zod schema
- Create: `lib/validations/name-prefix.test.ts` — shared prefix validation tests
- Modify: `lib/validations/user-schema.ts` — add `name_prefix` to create/update schemas
- Modify: `lib/validations/personnel.ts` — add `name_prefix` to personnel patch schema
- Modify: `lib/supabase/types.ts` — add `Profile.name_prefix`
- Modify: `types/users.ts` — add `UserProfile.name_prefix`

### Persistence and user service

- Create: `supabase/migrations/20260824100000_personnel_name_prefix.sql` — nullable column and allowed-value constraint
- Modify: `lib/services/users.ts` — include `name_prefix` in create upsert; existing update spread will persist it

### Personnel screens

- Create: `scripts/personnel-name-prefix.test.ts` — source-level contract test for migration, forms, payloads, and display wiring
- Modify: `app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx` — detail heading, form state, dropdown, PATCH payload
- Modify: `app/(protected)/staff/personnel/[id]/page.tsx` — load prefix for staff options and format names
- Modify: `app/(protected)/staff/personnel/page.tsx` — format roster display names
- Modify: `app/(protected)/staff/personnel/manage/page.tsx` — format management table names
- Modify: `app/(protected)/staff/personnel/compliance/page.tsx` — format compliance rows
- Modify: `app/(protected)/staff/personnel/exams/page.tsx` — format exam assignment roster names
- Modify: `app/(protected)/staff/personnel/org/page.tsx` — load and format org-chart staff options
- Modify: `app/(protected)/staff/personnel/team-org/page.tsx` — load and format team-org names

### User management

- Modify: `app/(protected)/staff/admin/AdminUserClient.tsx` — create/edit form state, dropdown, payloads, and visible user names
- No route changes: `app/api/admin/users/route.ts` and `app/api/admin/users/[id]/route.ts` already validate through the shared schemas and call `createUser`/`updateUser`
- No personnel route changes: `app/api/admin/personnel/[id]/route.ts` already validates through `PersonnelProfileSchema`

---

## Task 1: Write the complete failing tests

**Files:**

- Create: `lib/personnel/name.test.ts`
- Create: `lib/validations/name-prefix.test.ts`
- Create: `scripts/personnel-name-prefix.test.ts`

**Interfaces:**

- The tests define the required public interfaces before implementation: `NAME_PREFIX_OPTIONS`, `formatProfileName`, and `name_prefix` in both validation schemas and both form flows.

- [ ] **Step 1: Write the failing formatter test**

Create `lib/personnel/name.test.ts` with:

```ts
import { strict as assert } from 'node:assert'
import { NAME_PREFIX_OPTIONS, formatProfileName } from './name'

assert.deepEqual(NAME_PREFIX_OPTIONS, ['นาย', 'น.ส.', 'นาง'])
assert.equal(formatProfileName('สมหญิง ใจดี', 'นาง'), 'นางสมหญิง ใจดี')
assert.equal(formatProfileName(' สมหญิง ใจดี ', ' นาย '), 'นายสมหญิง ใจดี')
assert.equal(formatProfileName('สมหญิง ใจดี', null), 'สมหญิง ใจดี')
assert.equal(formatProfileName('  ', 'นาง'), 'นาง')
assert.equal(formatProfileName(null, null), '')

console.log('lib/personnel/name.test.ts: all assertions passed')
```

- [ ] **Step 2: Write the failing validation test**

Create `lib/validations/name-prefix.test.ts` with:

```ts
import { strict as assert } from 'node:assert'
import { createUserSchema, updateUserSchema } from './user-schema'
import { PersonnelProfileSchema } from './personnel'

const schemas = [
  ['create user', createUserSchema.pick({ name_prefix: true })],
  ['update user', updateUserSchema.pick({ name_prefix: true })],
  ['personnel profile', PersonnelProfileSchema.pick({ name_prefix: true })],
] as const

for (const [label, schema] of schemas) {
  for (const value of ['นาย', 'น.ส.', 'นาง'] as const) {
    const result = schema.safeParse({ name_prefix: value })
    assert.equal(result.success, true, `${label} should accept ${value}`)
  }
  const empty = schema.safeParse({ name_prefix: '' })
  assert.equal(empty.success, true, `${label} should accept empty value`)
  if (empty.success) assert.equal(empty.data.name_prefix, null, `${label} should normalize empty value`)
  assert.equal(schema.safeParse({ name_prefix: null }).success, true, `${label} should accept null`)
  assert.equal(schema.safeParse({ name_prefix: 'ดร.' }).success, false, `${label} should reject unsupported prefix`)
}

console.log('lib/validations/name-prefix.test.ts: all assertions passed')
```

- [ ] **Step 3: Write the failing UI and migration contract test**

Create `scripts/personnel-name-prefix.test.ts` with:

```ts
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20260824100000_personnel_name_prefix.sql')
const detail = read('app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx')
const detailPage = read('app/(protected)/staff/personnel/[id]/page.tsx')
const admin = read('app/(protected)/staff/admin/AdminUserClient.tsx')

assert.match(migration, /ADD COLUMN IF NOT EXISTS name_prefix text/)
assert.match(migration, /name_prefix IN \('นาย', 'น\.ส\.', 'นาง'\)/)
assert.match(detail, /name_prefix: prof\.name_prefix \?\? ''/)
assert.match(detail, /<Field label="คำนำหน้าชื่อ">/)
assert.match(detail, /formatProfileName\(prof\.name, prof\.name_prefix\)/)
assert.match(detailPage, /select\('id, name, name_prefix'\)/)
assert.match(admin, /name_prefix: user\?\.name_prefix \?\? ''/)
assert.match(admin, /<Field label="คำนำหน้าชื่อ">/)
assert.match(admin, /name_prefix: form\.name_prefix/)
assert.match(admin, /formatProfileName\(user\.name, user\.name_prefix\)/)

console.log('scripts/personnel-name-prefix.test.ts: all assertions passed')
```

- [ ] **Step 4: Run all new tests and verify the expected RED state**

Run:

```text
npx tsx lib/personnel/name.test.ts
npx tsx lib/validations/name-prefix.test.ts
npx tsx scripts/personnel-name-prefix.test.ts
```

Expected: all three commands fail because `lib/personnel/name.ts`, the new schema fields, the migration, and the UI wiring do not exist yet. Do not edit production code before observing these failures.

- [ ] **Step 5: Commit the failing test suite**

```text
git add -- lib/personnel/name.test.ts lib/validations/name-prefix.test.ts scripts/personnel-name-prefix.test.ts
git commit -m "test: define personnel name prefix behavior"
```

---

## Task 2: Implement shared name domain, validation, types, migration, and create service

**Files:**

- Create: `lib/personnel/name.ts`
- Create: `lib/validations/name-prefix.ts`
- Create: `supabase/migrations/20260824100000_personnel_name_prefix.sql`
- Modify: `lib/validations/user-schema.ts`
- Modify: `lib/validations/personnel.ts`
- Modify: `lib/supabase/types.ts`
- Modify: `types/users.ts`
- Modify: `lib/services/users.ts`

**Interfaces:**

- Produces `NAME_PREFIX_OPTIONS`, `NamePrefix`, and `formatProfileName` for all UI consumers.
- Produces `namePrefixSchema` for both user and personnel validation.
- Produces `Profile.name_prefix` and `UserProfile.name_prefix` for later form state.

- [ ] **Step 1: Implement the minimal shared formatter and options**

Create `lib/personnel/name.ts`:

```ts
export const NAME_PREFIX_OPTIONS = ['นาย', 'น.ส.', 'นาง'] as const
export type NamePrefix = typeof NAME_PREFIX_OPTIONS[number]

export function formatProfileName(name: string | null | undefined, prefix: string | null | undefined): string {
  const normalizedName = name?.trim() ?? ''
  const normalizedPrefix = prefix?.trim() ?? ''
  return `${normalizedPrefix}${normalizedName}`.trim()
}
```

- [ ] **Step 2: Run the formatter test and verify it passes**

Run `npx tsx lib/personnel/name.test.ts`.

Expected: `lib/personnel/name.test.ts: all assertions passed`.

- [ ] **Step 3: Add the shared nullable Zod schema and wire both validators**

Create `lib/validations/name-prefix.ts`:

```ts
import { z } from 'zod'
import { NAME_PREFIX_OPTIONS } from '@/lib/personnel/name'

export const namePrefixSchema = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? null : value,
  z.enum(NAME_PREFIX_OPTIONS).optional().nullable(),
)
```

In both `lib/validations/user-schema.ts` and `lib/validations/personnel.ts`, import `namePrefixSchema` from `@/lib/validations/name-prefix` and add `name_prefix: namePrefixSchema` to the relevant object schema. This is the only prefix schema definition; all three validators use the same instance and normalization behavior.

- [ ] **Step 4: Add `name_prefix` to the TypeScript profile models**

Import `NamePrefix` as a type and add:

```ts
name_prefix?: NamePrefix | null
```

to `Profile` in `lib/supabase/types.ts`, and:

```ts
name_prefix: NamePrefix | null
```

to `UserProfile` in `types/users.ts`.

- [ ] **Step 5: Add the personnel schema field**

Add `name_prefix` to `PersonnelProfileSchema` using the same nullable/empty-string normalization as the user schemas. It must accept the three allowed values, `''`, and `null`, and reject any other value.

- [ ] **Step 6: Add the idempotent database migration**

Create `supabase/migrations/20260824100000_personnel_name_prefix.sql`:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name_prefix text;

DO $$ BEGIN
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_name_prefix_check
    CHECK (name_prefix IS NULL OR name_prefix IN ('นาย', 'น.ส.', 'นาง'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

- [ ] **Step 7: Persist prefix when creating a user**

In the `profiles.upsert` object in `lib/services/users.ts`, add:

```ts
name_prefix: input.name_prefix ?? null,
```

Leave `profiles.name` and auth metadata as the raw name input. The existing `updateUser` function spreads the validated input into `profiles.update`, so the new update schema field is persisted without a second mapping branch.

- [ ] **Step 8: Run shared tests and verify GREEN**

Run:

```text
npx tsx lib/personnel/name.test.ts
npx tsx lib/validations/name-prefix.test.ts
```

Expected: both commands pass. The UI/migration contract test may still fail until Task 3 and Task 4 complete.

- [ ] **Step 9: Commit the shared implementation**

```text
git add -- lib/personnel/name.ts lib/validations/user-schema.ts lib/validations/personnel.ts lib/supabase/types.ts types/users.ts lib/services/users.ts supabase/migrations/20260824100000_personnel_name_prefix.sql lib/personnel/name.test.ts lib/validations/name-prefix.test.ts
git commit -m "feat: add shared personnel name prefix model"
```

---

## Task 3: Implement personnel detail form and personnel screen display

**Files:**

- Modify: `app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx`
- Modify: `app/(protected)/staff/personnel/[id]/page.tsx`
- Modify: `app/(protected)/staff/personnel/page.tsx`
- Modify: `app/(protected)/staff/personnel/manage/page.tsx`
- Modify: `app/(protected)/staff/personnel/compliance/page.tsx`
- Modify: `app/(protected)/staff/personnel/exams/page.tsx`
- Modify: `app/(protected)/staff/personnel/org/page.tsx`
- Modify: `app/(protected)/staff/personnel/team-org/page.tsx`

**Interfaces:**

- Consumes `formatProfileName`, `NAME_PREFIX_OPTIONS`, and `Profile.name_prefix` from Task 2.
- Produces persisted detail-form edits and formatted names across the personnel screens in scope.

- [ ] **Step 1: Run the personnel contract test before UI changes**

Run `npx tsx scripts/personnel-name-prefix.test.ts`.

Expected: FAIL at the first missing migration/form assertion. This confirms the test catches the requested behavior.

- [ ] **Step 2: Wire the detail profile header and form state**

In `StaffDetailClient.tsx`:

1. Import `NAME_PREFIX_OPTIONS` and `formatProfileName` from `@/lib/personnel/name`.
2. Render the header with `formatProfileName(prof.name, prof.name_prefix)`.
3. Add `name_prefix: prof.name_prefix ?? ''` to the profile form state.
4. Add a `Field` before the employee ID field:

```tsx
<Field label="คำนำหน้าชื่อ">
  <select
    style={inputStyle}
    value={form.name_prefix}
    onChange={(e) => setForm({ ...form, name_prefix: e.target.value })}
  >
    <option value="">— ไม่ระบุ —</option>
    {NAME_PREFIX_OPTIONS.map((prefix) => <option key={prefix} value={prefix}>{prefix}</option>)}
  </select>
</Field>
```

5. Include `name_prefix: form.name_prefix` in the non-license payload branch; the full `form` branch already includes it.

- [ ] **Step 3: Wire detail-page staff options**

In `app/(protected)/staff/personnel/[id]/page.tsx`, change the explicit profile query to select `id, name, name_prefix`, import `formatProfileName`, and map staff options with:

```ts
name: formatProfileName(s.name, s.name_prefix)
```

This keeps assessor selectors consistent with the displayed profile names.

- [ ] **Step 4: Format names in personnel roster and management pages**

Import `formatProfileName` in `page.tsx` and `manage/page.tsx`, and change each roster mapping from `name: p.name` to:

```ts
name: formatProfileName(p.name, p.name_prefix)
```

No change is needed in `PersonnelClient.tsx` or `ManageClient.tsx` because they already render the `name` supplied by their server page.

- [ ] **Step 5: Format compliance and exam roster names**

In `compliance/page.tsx` and `exams/page.tsx`, import `formatProfileName` and use it when building `staffRows`/`roster` from `getStaffRoster()`.

- [ ] **Step 6: Format org-chart and team-org names**

1. In `org/page.tsx`, change the explicit query to `select('id, name, name_prefix')` and map options through `formatProfileName`.
2. In `team-org/page.tsx`, add `name_prefix` to the explicit profile select, import `formatProfileName`, and map `Person.name` through it before rendering `PersonBox`.

- [ ] **Step 7: Run the personnel contract test and verify GREEN**

Run:

```text
npx tsx scripts/personnel-name-prefix.test.ts
npx tsx lib/personnel/name.test.ts
npx tsx lib/validations/name-prefix.test.ts
```

Expected: the detail, migration, and shared behavior assertions pass; user-management assertions may remain red until Task 4.

- [ ] **Step 8: Commit the personnel UI implementation**

```text
git add -- 'app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx' 'app/(protected)/staff/personnel/[id]/page.tsx' 'app/(protected)/staff/personnel/page.tsx' 'app/(protected)/staff/personnel/manage/page.tsx' 'app/(protected)/staff/personnel/compliance/page.tsx' 'app/(protected)/staff/personnel/exams/page.tsx' 'app/(protected)/staff/personnel/org/page.tsx' 'app/(protected)/staff/personnel/team-org/page.tsx' scripts/personnel-name-prefix.test.ts
git commit -m "feat: add personnel name prefix field"
```

---

## Task 4: Implement user-management create/edit form and list display

**Files:**

- Modify: `app/(protected)/staff/admin/AdminUserClient.tsx`

**Interfaces:**

- Consumes `NAME_PREFIX_OPTIONS`, `formatProfileName`, `UserProfile.name_prefix`, and the schemas from Task 2.
- Produces create and edit requests containing `name_prefix`, plus formatted user-management names.

- [ ] **Step 1: Confirm the user-management assertions are still RED**

Run `npx tsx scripts/personnel-name-prefix.test.ts` and verify it fails on the missing `AdminUserClient` assertions.

- [ ] **Step 2: Add prefix state to the shared create/edit modal**

In `AdminUserClient.tsx`:

1. Import `NAME_PREFIX_OPTIONS` and `formatProfileName` from `@/lib/personnel/name`.
2. Add `name_prefix: user?.name_prefix ?? ''` to the `form` state in `UserFormModal`.
3. Add the dropdown before the name field:

```tsx
<Field label="คำนำหน้าชื่อ" error={errors.name_prefix}>
  <Sel value={form.name_prefix} onChange={set('name_prefix')} placeholder="— ไม่ระบุ —">
    {NAME_PREFIX_OPTIONS.map((prefix) => <option key={prefix} value={prefix}>{prefix}</option>)}
  </Sel>
</Field>
```

4. Add `name_prefix: form.name_prefix || null` to the edit payload. The create branch passes `form` to `createUserSchema`, so the field is included automatically and normalized by the schema.

- [ ] **Step 3: Format names rendered by the user-management screen**

Use `formatProfileName(user.name, user.name_prefix)` anywhere the user-management page displays a profile name in the list row, document-profile modal heading, status confirmation, and delete confirmation. Keep import-preview rows unchanged because bulk import is explicitly outside scope.

- [ ] **Step 4: Run all focused tests and verify GREEN**

Run:

```text
npx tsx lib/personnel/name.test.ts
npx tsx lib/validations/name-prefix.test.ts
npx tsx scripts/personnel-name-prefix.test.ts
```

Expected: all three commands pass with their `all assertions passed` messages.

- [ ] **Step 5: Commit the user-management implementation**

```text
git add -- 'app/(protected)/staff/admin/AdminUserClient.tsx' scripts/personnel-name-prefix.test.ts
git commit -m "feat: add name prefix to user management"
```

---

## Task 5: Full verification and handoff

**Files:**

- Verify: all files from Tasks 1–4
- No new production files are introduced in this task

- [ ] **Step 1: Run the complete focused regression suite**

```text
npx tsx lib/personnel/name.test.ts
npx tsx lib/validations/name-prefix.test.ts
npx tsx scripts/personnel-name-prefix.test.ts
```

Expected: three successful commands, zero assertion failures.

- [ ] **Step 2: Run TypeScript verification**

Run `npx tsc --noEmit`.

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 3: Run the production build**

Run `npm run build`.

Expected: exit code 0 and a successful Next.js production build.

- [ ] **Step 4: Inspect the final diff and repository status**

Run:

```text
git diff origin/main..HEAD --stat
git diff origin/main..HEAD --check
git status --short --branch
```

Verify that only the name-prefix spec/plan, migration, shared name/validation/types/service changes, personnel display/form changes, user-management form changes, and focused tests are present. Confirm no unrelated files are modified.

- [ ] **Step 5: Report evidence and user-facing behavior**

Report the exact focused-test results, type-check result, build result, commit hashes, and the final behavior: selecting `นาง` with `สมหญิง ใจดี` displays `นางสมหญิง ใจดี`; clearing the dropdown stores `NULL` and displays the raw name.
