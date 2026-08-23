# Chemical SDS Publication Copy and Delta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยน workflow และข้อความการเผยแพร่ SDS ให้ใช้ `เผยแพร่ทั้งงาน` สำหรับครั้งแรก และ `อัปเดตการเผยแพร่ (N รายการ)` สำหรับรายการที่เปลี่ยนแปลง พร้อมสื่อสารว่า room scope อัปเดตอัตโนมัติ

**Architecture:** เพิ่ม pure publication-summary helper เป็น source of truth สำหรับจำนวนรายการค้างและข้อความ จากนั้นให้ department repository ส่ง baseline/delta ไปยัง client ปรับ database RPC ให้จำ baseline การเผยแพร่ล่าสุดโดยไม่สร้างปุ่มหรือ endpoint ใหม่ และปรับ UI room ให้ระบุ auto-publication โดยไม่แสดงปุ่มเผยแพร่

**Tech Stack:** Next.js App Router 16.2.6, React 19, TypeScript, Supabase/Postgres migrations, Node `tsx` contract tests

## Global Constraints

- ใช้คำบนปุ่ม `เผยแพร่ทั้งงาน` และ `อัปเดตการเผยแพร่ (N รายการ)` เท่านั้นตามสถานะที่ระบุในสเปก
- ห้ามเพิ่มหรือคงคำว่า `เผยแพร่การเปลี่ยนแปลง` ใน implementation ที่เกี่ยวข้อง
- Room scope ไม่มีปุ่มเผยแพร่ระดับงาน และการแก้ไขต้องสื่อว่าอัปเดตอัตโนมัติ
- ใช้ `apply_patch` สำหรับการแก้ไฟล์
- ต้องเห็น failing test ก่อนเขียน production TypeScript ตาม TDD
- ถ้าเพิ่ม route protected ใหม่ต้องอัปเดต `proxy.ts`; งานนี้ไม่เพิ่ม route ใหม่

---

### Task 1: Publication summary contract

**Files:**
- Create: `lib/chemical-safety/publication-summary.ts`
- Test: `lib/chemical-safety/publication-summary.test.ts`

**Interfaces:**
- Consumes department status, publication timestamps, version timestamps, and room publication state.
- Produces `summarizeDepartmentPublication(input)` and `roomPublicationLabel(status)` for repository/UI consumers.

- [ ] **Step 1: Write the failing tests**

สร้าง test cases ที่ assert exact result ดังนี้:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { roomPublicationLabel, summarizeDepartmentPublication } from './publication-summary'

const publication = (id: string, linkedAt: string, versionUpdatedAt = linkedAt) => ({ id, linkedAt, versionUpdatedAt })

test('uses first-publication copy when a department has never been published', () => {
  assert.deepEqual(summarizeDepartmentPublication({
    status: 'draft', publishedAt: null, lastPublishedAt: null,
    activePublications: [publication('a', '2026-08-23T01:00:00.000Z')],
  }), { action: 'publish', buttonLabel: 'เผยแพร่ทั้งงาน', helperText: null, pendingCount: 0 })
})

test('uses update copy and counts a newly linked publication after the baseline', () => {
  assert.deepEqual(summarizeDepartmentPublication({
    status: 'draft', publishedAt: null, lastPublishedAt: '2026-08-22T01:00:00.000Z',
    activePublications: [publication('a', '2026-08-23T01:00:00.000Z')],
  }), {
    action: 'update', buttonLabel: 'อัปเดตการเผยแพร่ (1 รายการ)',
    helperText: 'มีการเปลี่ยนแปลงรอเผยแพร่ 1 รายการ', pendingCount: 1,
  })
})

test('counts an existing publication whose SDS version was edited after the baseline', () => {
  const result = summarizeDepartmentPublication({
    status: 'published', publishedAt: '2026-08-22T01:00:00.000Z', lastPublishedAt: '2026-08-22T01:00:00.000Z',
    activePublications: [publication('a', '2026-08-20T01:00:00.000Z', '2026-08-23T01:00:00.000Z')],
  })
  assert.equal(result.action, 'update')
  assert.equal(result.buttonLabel, 'อัปเดตการเผยแพร่ (1 รายการ)')
  assert.equal(result.pendingCount, 1)
})

test('shows unpublish copy when a published department has no pending item', () => {
  assert.deepEqual(summarizeDepartmentPublication({
    status: 'published', publishedAt: '2026-08-22T01:00:00.000Z', lastPublishedAt: '2026-08-22T01:00:00.000Z',
    activePublications: [publication('a', '2026-08-20T01:00:00.000Z')],
  }), { action: 'unpublish', buttonLabel: 'ยกเลิกเผยแพร่ทั้งงาน', helperText: null, pendingCount: 0 })
})

test('uses the room auto-publication labels', () => {
  assert.equal(roomPublicationLabel('active'), 'เผยแพร่แล้ว · อัปเดตอัตโนมัติ')
  assert.equal(roomPublicationLabel('ready'), 'พร้อมเผยแพร่อัตโนมัติ')
  assert.equal(roomPublicationLabel('stale'), 'มีฉบับใหม่ · อัปเดตอัตโนมัติ')
  assert.equal(roomPublicationLabel('unlinked'), 'ยังไม่มีการเผยแพร่ · ต้องแนบ SDS')
})
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run:

```powershell
npm exec tsx -- lib/chemical-safety/publication-summary.test.ts
```

Expected: FAIL because `./publication-summary` does not exist yet.

- [ ] **Step 3: Implement the minimal pure helper**

Implement `DepartmentPublicationActivity`, `DepartmentPublicationSummaryInput`, `DepartmentPublicationSummary`, `summarizeDepartmentPublication`, and `roomPublicationLabel`. Use `lastPublishedAt ?? publishedAt` as the baseline. Count unique active publication IDs whose `linkedAt` or `versionUpdatedAt` is strictly newer than the baseline; if there is no baseline, return zero pending items and the first-publication action. Choose `update` only when `pendingCount > 0` and there is a baseline. Choose `unpublish` only when status is published and there are no pending items. All other cases use `publish`.

- [ ] **Step 4: Run the focused test and verify it passes**

Run the same `npm exec tsx -- lib/chemical-safety/publication-summary.test.ts` command. Expected: 5 passing tests, exit code 0.

---

### Task 2: Persist and load the publication baseline

**Files:**
- Create: `supabase/migrations/20260823072949_chemical_safety_publication_delta_baseline.sql`
- Modify: `lib/chemical-safety/department-repository.ts`
- Test: `scripts/chemical-safety-publication-delta.test.ts`

**Interfaces:**
- Migration adds nullable `last_published_by` and `last_published_at` to `chemical_sds_departments`.
- `DepartmentSdsGroupDTO` adds `lastPublishedAt`, `hasPublishedBefore`, and `pendingCount`.
- Repository uses `summarizeDepartmentPublication` with active publication and version timestamps.

- [ ] **Step 1: Write the failing repository/contract assertions**

Create a static contract test that reads the repository and generated migration and asserts:

```ts
assert.match(repository, /pendingCount/)
assert.match(repository, /last_published_at/)
assert.match(repository, /summarizeDepartmentPublication/)
assert.match(migration, /ADD COLUMN IF NOT EXISTS last_published_at/i)
assert.match(migration, /last_published_by/i)
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run `npm exec tsx -- scripts/chemical-safety-publication-delta.test.ts`. Expected: FAIL because the repository and migration do not expose the new baseline fields.

- [ ] **Step 3: Generate and implement the migration**

Run `supabase --help`, `supabase migration --help`, then `supabase migration new chemical_safety_publication_delta_baseline`. In the generated SQL file, add both nullable columns with a foreign key from `last_published_by` to `public.profiles(id)`, backfill them from existing `published_by`/`published_at` where status is published, and replace `set_chemical_sds_department_publication_status(text,text,uuid)` so published writes current and last publisher/time while a user-requested draft clears current and last publisher/time. Keep the existing empty-department check, authorization boundary, audit action, return value, and coherent current-status constraint. The publication-link function must not clear the new historical fields when it resets current status to draft.

- [ ] **Step 4: Update the repository DTO and query mapping**

In `lib/chemical-safety/department-repository.ts`, import the pure helper; add `lastPublishedAt`, `hasPublishedBefore`, and `pendingCount` to `DepartmentSdsGroupDTO`; build a `versionUpdatedAtById` map from the existing version query; filter active department publications by `department_code`; pass their IDs and timestamps plus the department baseline to `summarizeDepartmentPublication`; and return the summary fields while preserving existing file ordering, file count, publisher name, and seed behavior.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npm exec tsx -- scripts/chemical-safety-publication-delta.test.ts
npm exec tsx -- lib/chemical-safety/publication-summary.test.ts
```

Expected: all focused tests pass.

---

### Task 3: Apply exact department button and helper copy

**Files:**
- Modify: `components/chemical-safety/ChemicalSafetyHubClient.tsx`
- Modify: `components/chemical-safety/SdsManagementClient.tsx`
- Test: `scripts/chemical-safety-publication-copy.test.ts`

**Interfaces:**
- Consumes `selectedDepartment.pendingCount` and the baseline fields from Task 2.
- Uses the pure helper as the single source of truth for action/copy selection.

- [ ] **Step 1: Write the failing UI copy contract**

Assert the hub contains the approved strings and does not contain the rejected label:

```ts
assert.match(hub, /เผยแพร่ทั้งงาน/)
assert.match(hub, /อัปเดตการเผยแพร่/) 
assert.match(hub, /มีการเปลี่ยนแปลงรอเผยแพร่/)
assert.doesNotMatch(hub, /เผยแพร่การเปลี่ยนแปลง/)
assert.doesNotMatch(sdsManagement, /เผยแพร่การเปลี่ยนแปลง/)
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run `npm exec tsx -- scripts/chemical-safety-publication-copy.test.ts`. Expected: FAIL because the exact update label/helper is not in the hub yet.

- [ ] **Step 3: Wire the department summary into the client**

In `ChemicalSafetyHubClient.tsx`, import the helper; compute the selected department action from its status, baseline, and `pendingCount`; render `เผยแพร่ทั้งงาน` for first publication, `อัปเดตการเผยแพร่ (${pendingCount} รายการ)` plus `มีการเปลี่ยนแปลงรอเผยแพร่ ${pendingCount} รายการ` for update, and retain `ยกเลิกเผยแพร่ทั้งงาน` for unpublish. Change only the update success toast to `อัปเดตการเผยแพร่ของงานแล้ว`; retain the existing first-publish/unpublish toasts, route, authorization, busy state, disable rule, and refresh behavior. Update the SDS management description so it says SDS is edited from the registry and department publication is controlled there without implying every unchanged file must be republished.

- [ ] **Step 4: Run the UI copy contract and focused helper tests**

Run both focused commands from Tasks 1 and 3. Expected: all pass.

---

### Task 4: Make room auto-publication explicit in UI feedback

**Files:**
- Modify: `components/chemical-safety/ChemicalSafetyHubClient.tsx`
- Modify: `components/chemical-safety/RegistryChangeModal.tsx`
- Test: `scripts/chemical-safety-room-auto-publication.test.ts`

**Interfaces:**
- Uses `roomPublicationLabel` from `lib/chemical-safety/publication-summary.ts`.
- Does not add a room publication endpoint or button.

- [ ] **Step 1: Write the failing room copy contract**

Assert the component contains room auto-publication wording and does not add a room publish action:

```ts
assert.match(hub, /อัปเดตอัตโนมัติ/)
assert.match(registryModal, /มีผลทันที/)
assert.doesNotMatch(hub, /เผยแพร่ห้องเก็บสารเคมี/)
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run `npm exec tsx -- scripts/chemical-safety-room-auto-publication.test.ts`. Expected: FAIL because room row status still uses generic publication labels.

- [ ] **Step 3: Implement room-specific status and save feedback**

In the registry row status cell, call `roomPublicationLabel` for `storageScope === 'room'` and leave department labels unchanged. Add a compact explanatory note near the room-filtered registry view: `สารในห้องเก็บสารเคมีเผยแพร่อัตโนมัติ · แก้ไขแล้วมีผลทันที`. In `RegistryChangeModal`, make the eyebrow and `onSaved` messages scope-aware: room edit/create with SDS uses `บันทึกสารเคมีในห้องเก็บสารแล้ว · เผยแพร่อัตโนมัติ`; room create without SDS uses `บันทึกทะเบียนสารเคมีแล้ว · รอแนบ SDS เพื่อเผยแพร่`; department scope retains existing generic save wording. Do not render a publication button for room scope.

- [ ] **Step 4: Run room copy and helper tests**

Run `npm exec tsx -- scripts/chemical-safety-room-auto-publication.test.ts` and `npm exec tsx -- lib/chemical-safety/publication-summary.test.ts`. Expected: all pass.

---

### Task 5: Full verification and handoff

**Files:**
- Verify all changed files from Tasks 1–4

- [ ] **Step 1: Run chemical-safety contract suite**

Run `npm run test:chemical-safety`. Expected: exit code 0 with no failed tests.

- [ ] **Step 2: Run TypeScript verification**

Run `npm exec tsc -- --noEmit`. Expected: exit code 0.

- [ ] **Step 3: Run the production build**

Run `npm run build`. Expected: exit code 0.

- [ ] **Step 4: Inspect the final diff and copy contract**

Run `git diff --check`, `git status --short`, `git diff --stat`, and `git grep -n "เผยแพร่การเปลี่ยนแปลง" -- components lib app scripts supabase`. Expected: no whitespace errors, feature-scoped changed files, and no matches for the rejected phrase.

- [ ] **Step 5: Report evidence and environment limitations**

Summarize exact files changed, test/build exit codes, and separately report if Supabase CLI/database verification could not run because credentials or CLI are unavailable. Do not claim the migration was applied unless a fresh database command confirms it.
