# Multi-role and multi-category authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow multiple roles and categories to be granted in one operation from staff detail and group management.

**Architecture:** Keep `staff_authorizations` as one role and one scope per row. A shared pure module expands selected roles and categories into unique rows. The existing bulk route and a new per-profile batch route use it, skip active duplicates, and return counts. Dialogs use checkbox selectors only for new assignments; existing rows remain single-record edits.

**Tech Stack:** Next.js 16.2.6, React, TypeScript, Zod, Supabase, `tsx` and Node `assert`.

## Global Constraints

- Do not change `staff_authorizations` schema or existing data.
- Category selection creates profiles × roles × categories; test selection creates one test × roles.
- Existing active equal profile/scope/role records are skipped.
- Existing PATCH and DELETE remain single-record operations.
- Retain support for existing single authorization POST payloads.

---

### Task 1: Batch expansion and validation

**Files:**
- Create: `lib/personnel/authorization-batch.ts`
- Create: `lib/personnel/authorization-batch.test.ts`
- Modify: `lib/validations/personnel.ts:84-100`

**Interfaces:** Export `AuthorizationRole`, `AuthorizationBatchInput`, `expandAuthorizationRows`, `authorizationRowKey`, and `AuthorizationBatchSchema`.

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { expandAuthorizationRows } from './authorization-batch'

const rows = expandAuthorizationRows({
  profileIds: ['p1', 'p2'], testId: null, categories: ['เคมี', 'โลหิต'],
  roles: ['performer', 'approver'], common: { authorized_date: '2026-07-25' },
})
assert.equal(rows.length, 8)
assert.equal(new Set(rows.map((r) => `${r.profile_id}|${r.category}|${r.role_type}`)).size, 8)
assert.equal(expandAuthorizationRows({ profileIds: ['p1'], testId: 1, categories: [], roles: ['performer', 'performer'], common: {} }).length, 1)
```

- [ ] **Step 2: Verify red**

Run `npx tsx lib/personnel/authorization-batch.test.ts`; expect failure because the module is absent.

- [ ] **Step 3: Implement minimal expansion and Zod schema**

```ts
export const AuthorizationRoleSchema = z.enum(['performer', 'reporter', 'approver', 'authorized_signatory', 'deputy'])
export const AuthorizationBatchSchema = z.object({
  test_id: z.number().int().positive().nullable().optional(),
  categories: z.array(z.string().trim().min(1)).default([]),
  roles: z.array(AuthorizationRoleSchema).min(1, 'เลือกบทบาทอย่างน้อยหนึ่งบทบาท'),
  competency_id: z.string().uuid().nullable().optional(), authorized_date: optDate,
  status: z.literal('active').default('active'), notes: optStr,
}).superRefine((v, ctx) => {
  if (v.test_id == null && v.categories.length === 0) ctx.addIssue({ code: 'custom', path: ['categories'], message: 'เลือก test หรือหมวดอย่างน้อยหนึ่งรายการ' })
  if (v.test_id != null && v.categories.length > 0) ctx.addIssue({ code: 'custom', path: ['categories'], message: 'เลือกได้เพียง test หรือหมวด' })
})
export function expandAuthorizationRows(input: AuthorizationBatchInput) {
  const profiles = [...new Set(input.profileIds)], roles = [...new Set(input.roles)]
  const scopes = input.testId != null ? [{ test_id: input.testId, category: null }] : [...new Set(input.categories)].map((category) => ({ test_id: null, category }))
  return profiles.flatMap((profile_id) => scopes.flatMap((scope) => roles.map((role_type) => ({ profile_id, ...scope, role_type, ...input.common }))))
}
export const authorizationRowKey = (row: Pick<AuthorizationRow, 'profile_id' | 'test_id' | 'category' | 'role_type'>) => `${row.profile_id}|${row.test_id ?? ''}|${row.category ?? ''}|${row.role_type}`
```

Use `AuthorizationRoleSchema` in `AuthorizationBaseSchema`. Define `AuthorizationRow` as the returned insertable row shape.

- [ ] **Step 4: Verify green**

Run `npx tsx lib/personnel/authorization-batch.test.ts`; expect exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/personnel/authorization-batch.ts lib/personnel/authorization-batch.test.ts lib/validations/personnel.ts
git commit -m "feat: add authorization batch expansion"
```

### Task 2: Server-side batch creation and duplicate skipping

**Files:**
- Create: `app/api/admin/personnel/[id]/authorizations/batch/route.ts`
- Modify: `app/api/admin/personnel/bulk/route.ts:1-48`
- Create: `scripts/personnel-authorization-batch-contract.test.ts`

**Interfaces:** The single-profile endpoint returns `{ created, inserted, skipped }`; bulk returns `{ ok, count, skipped }`.

- [ ] **Step 1: Write failing contract assertions**

```ts
assert.match(readFileSync(resolve('app/api/admin/personnel/[id]/authorizations/batch/route.ts'), 'utf8'), /AuthorizationBatchSchema/)
assert.match(readFileSync(resolve('app/api/admin/personnel/[id]/authorizations/batch/route.ts'), 'utf8'), /authorizationRowKey/)
assert.match(readFileSync(resolve('app/api/admin/personnel/bulk/route.ts'), 'utf8'), /skipped/)
```

- [ ] **Step 2: Verify red**

Run `npx tsx scripts/personnel-authorization-batch-contract.test.ts`; expect failure because the route is absent.

- [ ] **Step 3: Implement routes**

The per-profile route must call `requirePersonnelManage()`, parse `AuthorizationBatchSchema`, expand `[id]`, query active non-deleted authorization rows, discard generated rows whose `authorizationRowKey` exists, insert the remainder with `created_by: actor.id`, and audit inserted/skipped totals.

In `bulk/route.ts`, branch for a batch payload when `type === 'authorizations'`. Expand `uniqueIds`, query existing active non-deleted matches once, insert only unseen rows, and return `count` and `skipped`. Keep the current `AuthorizationSchema` path as fallback for legacy single payloads.

- [ ] **Step 4: Verify green**

Run `npx tsx scripts/personnel-authorization-batch-contract.test.ts`; expect exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/personnel/[id]/authorizations/batch/route.ts app/api/admin/personnel/bulk/route.ts scripts/personnel-authorization-batch-contract.test.ts
git commit -m "feat: batch personnel authorizations"
```

### Task 3: Reusable multi-select control

**Files:**
- Create: `components/personnel/AuthorizationMultiSelect.tsx`
- Create: `components/personnel/AuthorizationMultiSelect.test.ts`

**Interfaces:** `AuthorizationMultiSelect({ label, options, value, onChange, emptyMessage })`, where options are `{ value: string; label: string }[]`.

- [ ] **Step 1: Write failing UI contract test**

```ts
const source = readFileSync(resolve('components/personnel/AuthorizationMultiSelect.tsx'), 'utf8')
assert.match(source, /type="checkbox"/)
assert.match(source, /aria-label=/)
assert.match(source, /value\.includes/)
```

- [ ] **Step 2: Verify red**

Run `npx tsx components/personnel/AuthorizationMultiSelect.test.ts`; expect failure because the component is absent.

- [ ] **Step 3: Implement the checkbox control**

```tsx
export function AuthorizationMultiSelect({ label, options, value, onChange, emptyMessage = 'ไม่มีตัวเลือก' }: Props) {
  const toggle = (option: string) => onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option])
  return <fieldset aria-label={label}>{options.length === 0 ? <span>{emptyMessage}</span> : options.map((option) => (
    <label key={option.value}><input type="checkbox" checked={value.includes(option.value)} onChange={() => toggle(option.value)} /> {option.label}</label>
  ))}</fieldset>
}
```

Style using existing CSS variables and include focus-visible state; do not add a dependency.

- [ ] **Step 4: Verify green**

Run `npx tsx components/personnel/AuthorizationMultiSelect.test.ts`; expect exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/personnel/AuthorizationMultiSelect.tsx components/personnel/AuthorizationMultiSelect.test.ts
git commit -m "feat: add authorization multi-select control"
```

### Task 4: Staff-detail authorization dialog

**Files:**
- Modify: `app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx:1547-1654`
- Create: `scripts/personnel-authorization-dialog-contract.test.ts`

**Interfaces:** For creation, post `{ test_id, categories, roles, competency_id, authorized_date, notes }` to the Task 2 batch route. Editing retains the existing single-record PATCH payload.

- [ ] **Step 1: Write failing dialog assertions**

```ts
const source = readFileSync(resolve('app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx'), 'utf8')
assert.match(source, /AuthorizationMultiSelect/)
assert.match(source, /role_types/)
assert.match(source, /categories/)
assert.match(source, /authorizations\/batch/)
assert.match(source, /จะสร้างสิทธิ์/)
```

- [ ] **Step 2: Verify red**

Run `npx tsx scripts/personnel-authorization-dialog-contract.test.ts`; expect failure because the dialog has single selects.

- [ ] **Step 3: Implement creation flow**

Add `role_types: ['performer']` and `categories: []` to new form state. On create, render `AuthorizationMultiSelect` for roles and, for category scope, categories; test scope retains one test select. Display `จะสร้างสิทธิ์ N รายการ`, using `roles.length * (scope === 'category' ? categories.length : test_id ? 1 : 0)`. POST to the batch route, prepend `result.created`, and toast inserted/skipped totals. In edit mode render current single selects and retain PATCH behavior unchanged.

- [ ] **Step 4: Verify green**

Run `npx tsx scripts/personnel-authorization-dialog-contract.test.ts`; expect exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx scripts/personnel-authorization-dialog-contract.test.ts
git commit -m "feat: select multiple staff authorization roles"
```

### Task 5: Group-management bulk authorization dialog

**Files:**
- Modify: `app/(protected)/staff/personnel/manage/ManageClient.tsx:267-329`
- Modify: `scripts/personnel-authorization-dialog-contract.test.ts`

**Interfaces:** Post batch `categories` and `roles` to the enhanced bulk endpoint.

- [ ] **Step 1: Extend failing dialog assertions**

```ts
const source = readFileSync(resolve('app/(protected)/staff/personnel/manage/ManageClient.tsx'), 'utf8')
assert.match(source, /AuthorizationMultiSelect/)
assert.match(source, /authorizationCategories/)
assert.match(source, /authorizationRoles/)
assert.match(source, /สิทธิ์ที่จะสร้าง/)
```

- [ ] **Step 2: Verify red**

Run `npx tsx scripts/personnel-authorization-dialog-contract.test.ts`; expect failure because bulk management has single selects.

- [ ] **Step 3: Implement group flow**

Keep existing string state for training and competencies. Add `authorizationCategories` and `authorizationRoles`, initialized to `[]` and `['performer']`. The authorization branch of `buildPayload()` must reject empty arrays and return `{ categories: authorizationCategories, roles: authorizationRoles, authorized_date: form.authorized_date || null, notes: form.notes || null, status: 'active' }`. Replace the two selects with `AuthorizationMultiSelect`, show `สิทธิ์ที่จะสร้าง ${selectedIds.length * authorizationCategories.length * authorizationRoles.length} รายการ`, and include created/skipped response counts in the success message.

- [ ] **Step 4: Verify green**

Run `npx tsx scripts/personnel-authorization-dialog-contract.test.ts`; expect exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/(protected)/staff/personnel/manage/ManageClient.tsx scripts/personnel-authorization-dialog-contract.test.ts
git commit -m "feat: bulk assign multiple authorization categories"
```

### Task 6: Verification

**Files:** Verify only.

- [ ] **Step 1: Run focused tests**

```bash
npx tsx lib/personnel/authorization-batch.test.ts
npx tsx scripts/personnel-authorization-batch-contract.test.ts
npx tsx components/personnel/AuthorizationMultiSelect.test.ts
npx tsx scripts/personnel-authorization-dialog-contract.test.ts
```

Expected: every command exits 0.

- [ ] **Step 2: Run regression checks**

```bash
npx tsx lib/personnel/filters.test.ts
npx tsx lib/personnel/workforce.test.ts
npm run build
```

Expected: every command exits 0; build type-checks and generates routes.

- [ ] **Step 3: Commit only feature files**

```bash
git add lib/personnel/authorization-batch.ts lib/personnel/authorization-batch.test.ts lib/validations/personnel.ts app/api/admin/personnel/[id]/authorizations/batch/route.ts app/api/admin/personnel/bulk/route.ts components/personnel/AuthorizationMultiSelect.tsx components/personnel/AuthorizationMultiSelect.test.ts app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx app/(protected)/staff/personnel/manage/ManageClient.tsx scripts/personnel-authorization-batch-contract.test.ts scripts/personnel-authorization-dialog-contract.test.ts
git commit -m "feat: support multi-role authorization assignment"
```

Do not stage unrelated pre-existing changes.
