# QM/Lb Document Types + Consolidated Type Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new document types — Quality Manual (`QM`) and Log book (`Lb`) — remove the unused `Record` type, and make every place that displays a document type do so consistently as "ชื่อเต็ม (Code)", sourced from one shared constant instead of 4+ duplicated, inconsistent copies.

**Architecture:** `lib/validations/document.ts` stays the single source of truth for the list of valid type values (`DOC_TYPES`, feeds the zod schema). A new `lib/documents/type-labels.ts` re-exports `DOC_TYPES` and adds `TYPE_LABEL` (type → "Thai name (Code)" string) as the single source of truth for display labels; every file that currently hand-rolls its own label map imports from here instead. Per-file icon/badge *colors* are a separate, intentionally-not-consolidated concern (per design decision) — each color map just gets `QM`/`Lb` entries added and `Record` removed in place. A new one-off SQL script migrates the single existing `QM-LAB-01` document from `type=Manual` to `type=QM` and updates the DB CHECK constraint.

**Tech Stack:** Next.js App Router, TypeScript, Zod, Supabase (Postgres), plain `node:assert`-based test scripts run via `tsx` (this repo's existing test convention — no test framework is installed).

## Global Constraints

- Final type list (order matters for UI display order): `QP, WI, Form, Policy, Manual, QM, Reference, Card file, Lb, Others` — exactly these 10 string values, nothing else.
- `TYPE_LABEL` values (verbatim, do not alter wording):
  - `QP`: `'ระเบียบปฏิบัติ (QP)'`
  - `WI`: `'วิธีปฏิบัติงาน (WI)'`
  - `Form`: `'แบบฟอร์ม (Fm)'`
  - `Policy`: `'นโยบาย (CBH)'`
  - `Manual`: `'คู่มือ (MN)'`
  - `QM`: `'คู่มือคุณภาพ (QM)'`
  - `Reference`: `'เอกสารอ้างอิง (Rf)'`
  - `Card file`: `'เอกสารประกอบการปฏิบัติงาน (Cf)'`
  - `Lb`: `'สมุดบันทึก (Lb)'`
  - `Others`: `'เอกสารอื่นๆ'` (no code suffix)
- Compact table/badge cells (MasterListClient row badges, DocumentsClient library-table badges, ManualClient public badges) keep showing the **bare code only** — do not switch these to the full label. Only filters, dropdowns, category headers, and dashboard bars switch to the full "Name (Code)" label.
- `Record` is removed everywhere (0 documents use it — confirmed via a live DB count on 2026-07-11).
- Test convention: no test framework installed. Test files are plain scripts using `node:assert/strict`, run with `npx tsx --env-file=.env.local <path>` (the `--env-file` flag is required for any test file that transitively imports `@/lib/supabase/admin`, because that module throws at import time if Supabase env vars aren't in `process.env` — see `lib/risk-server.test.ts` for the established pattern). Files that don't import any Supabase module can drop `--env-file`.
- After every task that touches a `.ts`/`.tsx` file, run `npx tsc --noEmit` from the repo root and confirm zero output (zero errors) before moving on.

---

### Task 1: Update the DOC_TYPES source of truth and create the shared label constant

**Files:**
- Modify: `lib/validations/document.ts:4`
- Create: `lib/documents/type-labels.ts`
- Create: `lib/documents/type-labels.test.ts`

**Interfaces:**
- Consumes: nothing (foundational task).
- Produces: `DOC_TYPES` (re-exported from `lib/documents/type-labels.ts`, `readonly ['QP','WI','Form','Policy','Manual','QM','Reference','Card file','Lb','Others']`) and `TYPE_LABEL: Record<string, string>` — every later task imports one or both of these from `@/lib/documents/type-labels`.

- [ ] **Step 1: Write the failing test**

Create `lib/documents/type-labels.test.ts`:

```ts
import assert from 'node:assert/strict'
import { DOC_TYPES, TYPE_LABEL } from './type-labels'

const expected = ['QP', 'WI', 'Form', 'Policy', 'Manual', 'QM', 'Reference', 'Card file', 'Lb', 'Others']
assert.deepEqual([...DOC_TYPES], expected)
assert.ok(!DOC_TYPES.includes('Record' as never), 'Record must be removed')

for (const type of DOC_TYPES) {
  assert.ok(TYPE_LABEL[type], `TYPE_LABEL is missing an entry for "${type}"`)
}

assert.equal(TYPE_LABEL.QP, 'ระเบียบปฏิบัติ (QP)')
assert.equal(TYPE_LABEL.WI, 'วิธีปฏิบัติงาน (WI)')
assert.equal(TYPE_LABEL.Form, 'แบบฟอร์ม (Fm)')
assert.equal(TYPE_LABEL.Policy, 'นโยบาย (CBH)')
assert.equal(TYPE_LABEL.Manual, 'คู่มือ (MN)')
assert.equal(TYPE_LABEL.QM, 'คู่มือคุณภาพ (QM)')
assert.equal(TYPE_LABEL.Reference, 'เอกสารอ้างอิง (Rf)')
assert.equal(TYPE_LABEL['Card file'], 'เอกสารประกอบการปฏิบัติงาน (Cf)')
assert.equal(TYPE_LABEL.Lb, 'สมุดบันทึก (Lb)')
assert.equal(TYPE_LABEL.Others, 'เอกสารอื่นๆ')

console.log('type-labels tests passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx lib/documents/type-labels.test.ts`
Expected: fails with `Cannot find module './type-labels'` (the file doesn't exist yet).

- [ ] **Step 3: Update `lib/validations/document.ts` and create `lib/documents/type-labels.ts`**

In `lib/validations/document.ts`, change line 4 from:
```ts
export const DOC_TYPES = ['QP', 'WI', 'Form', 'Policy', 'Manual', 'Record', 'Reference', 'Card file', 'Others'] as const
```
to:
```ts
export const DOC_TYPES = ['QP', 'WI', 'Form', 'Policy', 'Manual', 'QM', 'Reference', 'Card file', 'Lb', 'Others'] as const
```

Create `lib/documents/type-labels.ts`:
```ts
// Single source of truth for document-type display labels — "ชื่อเต็ม (Code)".
// DOC_TYPES itself (the list of valid type values) lives in lib/validations/document.ts,
// which feeds the zod schema; re-exported here so label consumers only need one import.
export { DOC_TYPES } from '@/lib/validations/document'

export const TYPE_LABEL: Record<string, string> = {
  QP: 'ระเบียบปฏิบัติ (QP)',
  WI: 'วิธีปฏิบัติงาน (WI)',
  Form: 'แบบฟอร์ม (Fm)',
  Policy: 'นโยบาย (CBH)',
  Manual: 'คู่มือ (MN)',
  QM: 'คู่มือคุณภาพ (QM)',
  Reference: 'เอกสารอ้างอิง (Rf)',
  'Card file': 'เอกสารประกอบการปฏิบัติงาน (Cf)',
  Lb: 'สมุดบันทึก (Lb)',
  Others: 'เอกสารอื่นๆ',
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx lib/documents/type-labels.test.ts`
Expected: prints `type-labels tests passed`, exit code 0.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: this will currently report errors in every file that still references `'Record'` as a valid `type` value (e.g. `lib/supabase/types.ts`, `DocumentUploadModal.tsx`, all the `TYPE_TABS`/`TYPE_COLORS`/`TYPE_ICON_*` maps). That's expected at this point in the plan — those get fixed in later tasks. Confirm the errors you see are all pre-existing-code-referencing-`Record` errors (file:line matches the "Files to change" list in the design spec) and not something new/unrelated from this step.

- [ ] **Step 6: Commit**

```bash
git add lib/validations/document.ts lib/documents/type-labels.ts lib/documents/type-labels.test.ts
git commit -m "Add QM/Lb to DOC_TYPES, remove Record, add shared type-label constant"
```

---

### Task 2: Update the `Document` TypeScript type

**Files:**
- Modify: `lib/supabase/types.ts:279`

**Interfaces:**
- Consumes: nothing new (mirrors Task 1's `DOC_TYPES`, but this is a plain TS union, not a runtime import — `lib/supabase/types.ts` has no other imports from `lib/validations`, so keep it as a literal union here for consistency with the rest of that file, not a computed type).
- Produces: `Document['type']` now includes `'QM' | 'Lb'` and no longer includes `'Record'` — every later task that touches `doc.type`-typed values relies on this.

- [ ] **Step 1: Update the type union**

In `lib/supabase/types.ts`, change line 279 from:
```ts
  type: 'QP' | 'WI' | 'Form' | 'Policy' | 'Manual' | 'Record' | 'Reference' | 'Card file' | 'Others'
```
to:
```ts
  type: 'QP' | 'WI' | 'Form' | 'Policy' | 'Manual' | 'QM' | 'Reference' | 'Card file' | 'Lb' | 'Others'
```

Do **not** touch line 262 (`doc_type: 'QP' | 'WI' | 'Form' | 'Other'`) — that's the unrelated `TestDocument` interface for the `test_documents` table, out of scope.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: fewer errors than after Task 1 (any code that only read/wrote `Document['type']` without hardcoding `'Record'` in a string-literal map is now clean). Remaining errors should all trace to hardcoded `'Record'` literals in the map files still to be fixed.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "Update Document['type'] union for QM/Lb, remove Record"
```

---

### Task 3: Database migration — CHECK constraint + QM-LAB-01 data fix

**Files:**
- Create: `scripts/add-document-types-quality-manual-logbook.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: the live `documents.type` CHECK constraint now allows `QM`/`Lb` and disallows `Record`; the single `QM-LAB-01` row is reclassified.

- [ ] **Step 1: Write the migration script**

Create `scripts/add-document-types-quality-manual-logbook.sql`:
```sql
-- Add Quality Manual (QM) and Log book (Lb) document types, remove the unused Record type.
-- Run manually in Supabase Dashboard > SQL Editor, one statement block at a time, IN ORDER —
-- the constraint update (STEP 2) must run before the data update (STEP 3), or STEP 3's
-- type='QM' will be rejected by the old CHECK constraint.

-- STEP 1: preview — confirm this returns exactly one row (QM-LAB-01) before running STEP 3.
select id, document_code, title, type
from documents
where type = 'Manual' and document_code ilike 'QM-%';

-- STEP 2: update the CHECK constraint first — drop Record, add QM and Lb.
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_type_check
  CHECK (type IN ('QP','WI','Form','Policy','Manual','QM','Reference','Card file','Lb','Others'));

-- STEP 3: reclassify the existing Quality Manual document (QM-prefixed, was bucketed under
-- the generic Manual type before QM existed as its own type). Only valid now that STEP 2 ran.
update documents
set type = 'QM'
where document_code = 'QM-LAB-01' and type = 'Manual';

-- STEP 4: confirm no documents are using the type that was removed (expect 0 rows).
select id, document_code, title from documents where type = 'Record';
```

- [ ] **Step 2: Commit**

```bash
git add scripts/add-document-types-quality-manual-logbook.sql
git commit -m "Add DB migration script for QM/Lb document types"
```

This script is **not** run automatically — per this repo's established convention (see every other file under `scripts/*.sql`), it must be run manually in the Supabase SQL Editor. Note this explicitly to whoever reviews/deploys this plan; the app-level code changes in the remaining tasks will not take effect against real data until this script has been run (the CHECK constraint will reject any attempt to save `type='QM'` or `type='Lb'` until STEP 4 runs).

---

### Task 4: Update DocumentUploadModal — prefix map and type dropdown label

**Files:**
- Modify: `components/documents/DocumentUploadModal.tsx:108-116` (prefix map), `:817-824` (dropdown)

**Interfaces:**
- Consumes: `TYPE_LABEL` from `@/lib/documents/type-labels` (Task 1).
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Update the prefix→type map**

In `components/documents/DocumentUploadModal.tsx`, change lines 108-116 from:
```ts
const TYPE_BY_PREFIX: Record<string, string> = {
  QP: 'QP', WI: 'WI',
  QM: 'Manual', MN: 'Manual',
  FM: 'Form', FR: 'Form',
  PL: 'Policy', PO: 'Policy',
  RC: 'Record', RD: 'Record',
  RF: 'Reference',
  CF: 'Card file',
}
```
to:
```ts
const TYPE_BY_PREFIX: Record<string, string> = {
  QP: 'QP', WI: 'WI',
  QM: 'QM', MN: 'Manual',
  FM: 'Form', FR: 'Form',
  PL: 'Policy', PO: 'Policy',
  RF: 'Reference',
  CF: 'Card file',
  LB: 'Lb',
}
```
(`QM` now maps to the new `QM` type instead of `Manual`; `RC`/`RD` are removed since `Record` no longer exists as a valid type — a code prefixed `RC-`/`RD-` would otherwise auto-detect an invalid type; `LB` is added for Log book documents.)

- [ ] **Step 2: Add the `TYPE_LABEL` import**

Add to the top imports (near the existing `import { DOC_TYPES, DOC_VISIBILITIES } from '@/lib/validations/document'` line):
```ts
import { TYPE_LABEL } from '@/lib/documents/type-labels'
```

- [ ] **Step 3: Show the full label in the type dropdown**

Change line 823 from:
```tsx
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
```
to:
```tsx
                {DOC_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 5: Commit**

```bash
git add components/documents/DocumentUploadModal.tsx
git commit -m "Wire QM/Lb into upload-form prefix map and show full type labels in dropdown"
```

---

### Task 5: Update shared icon colors (`lib/documents/ui-constants.ts`)

**Files:**
- Modify: `lib/documents/ui-constants.ts:5-13`

**Interfaces:**
- Consumes: nothing.
- Produces: `TYPE_ICON_BG`/`TYPE_ICON_FG` now have `QM`/`Lb` entries and no `Record` entry — `ReadReportClient.tsx`, `PendingClient.tsx`, and `DocumentDetailModal.tsx` all import these and need **no code change** of their own, since they already do `TYPE_ICON_BG[doc.type] ?? fallback` lookups.

- [ ] **Step 1: Update the color maps**

In `lib/documents/ui-constants.ts`, change lines 5-13 from:
```ts
export const TYPE_ICON_BG: Record<string, string> = {
  QP: 'rgba(30,95,173,.10)', WI: 'rgba(13,148,136,.10)', Form: 'rgba(147,51,234,.10)',
  Policy: 'rgba(217,119,6,.10)', Manual: 'rgba(22,163,74,.10)',
  Record: 'rgba(100,116,139,.10)', Reference: 'rgba(234,88,12,.10)', 'Card file': 'rgba(245,158,11,.10)', Others: 'rgba(100,116,139,.10)',
}
export const TYPE_ICON_FG: Record<string, string> = {
  QP: '#1E5FAD', WI: '#0D9488', Form: '#9333EA',
  Policy: '#D97706', Manual: '#16A34A', Record: '#64748B', Reference: '#EA580C', 'Card file': '#F59E0B', Others: '#64748B',
}
```
to:
```ts
export const TYPE_ICON_BG: Record<string, string> = {
  QP: 'rgba(30,95,173,.10)', WI: 'rgba(13,148,136,.10)', Form: 'rgba(147,51,234,.10)',
  Policy: 'rgba(217,119,6,.10)', Manual: 'rgba(22,163,74,.10)', QM: 'rgba(5,150,105,.10)',
  Reference: 'rgba(234,88,12,.10)', 'Card file': 'rgba(245,158,11,.10)', Lb: 'rgba(79,70,229,.10)', Others: 'rgba(100,116,139,.10)',
}
export const TYPE_ICON_FG: Record<string, string> = {
  QP: '#1E5FAD', WI: '#0D9488', Form: '#9333EA',
  Policy: '#D97706', Manual: '#16A34A', QM: '#059669', Reference: '#EA580C', 'Card file': '#F59E0B', Lb: '#4F46E5', Others: '#64748B',
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add lib/documents/ui-constants.ts
git commit -m "Add QM/Lb icon colors, remove Record"
```

---

### Task 6: Add QM to the annual-review workflow

**Files:**
- Modify: `lib/documents/review.ts:9`
- Create: `lib/documents/review.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `REVIEW_TRACKED_TYPES` includes `'QM'`.

- [ ] **Step 1: Write the failing test**

Create `lib/documents/review.test.ts`:
```ts
import assert from 'node:assert/strict'
import { REVIEW_TRACKED_TYPES } from './review'

// QM-LAB-01 was tracked under 'Manual' before the QM split; it must stay tracked as 'QM'
// after the split, or it silently drops out of the annual-review workflow.
assert.ok((REVIEW_TRACKED_TYPES as readonly string[]).includes('QM'), 'QM must remain in REVIEW_TRACKED_TYPES after the Manual/QM split')
assert.ok((REVIEW_TRACKED_TYPES as readonly string[]).includes('Manual'))
assert.ok((REVIEW_TRACKED_TYPES as readonly string[]).includes('QP'))
assert.ok((REVIEW_TRACKED_TYPES as readonly string[]).includes('WI'))

console.log('review.ts REVIEW_TRACKED_TYPES tests passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx lib/documents/review.test.ts`
Expected: `AssertionError` on the first assertion (`'QM' must remain in REVIEW_TRACKED_TYPES...`) since `REVIEW_TRACKED_TYPES` is still `['QP', 'WI', 'Manual']`.

- [ ] **Step 3: Update REVIEW_TRACKED_TYPES**

In `lib/documents/review.ts`, change line 9 from:
```ts
export const REVIEW_TRACKED_TYPES = ['QP', 'WI', 'Manual'] as const
```
to:
```ts
export const REVIEW_TRACKED_TYPES = ['QP', 'WI', 'Manual', 'QM'] as const
```

Also update the comment on lines 11-13 (currently references "Manual (QM/MN)" as one concept, which is no longer accurate) from:
```ts
// Types eligible for the one-click "ทบทวนแล้ว ไม่มีการแก้ไข" (review-only) flow. Manual
// (QM/MN) has no cover page and a different layout, so it must go through a full Rev+ —
// it still gets the reminder badge (REVIEW_TRACKED_TYPES) but not the review-only action.
```
to:
```ts
// Types eligible for the one-click "ทบทวนแล้ว ไม่มีการแก้ไข" (review-only) flow. Manual and QM
// have no cover page and a different layout, so they must go through a full Rev+ — they still
// get the reminder badge (REVIEW_TRACKED_TYPES) but not the review-only action.
```

Leave `REVIEW_ONLY_TYPES` (line 14, `['QP', 'WI'] as const`) unchanged — `QM` should not be review-only-eligible, matching how `Manual` isn't today.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx lib/documents/review.test.ts`
Expected: prints `review.ts REVIEW_TRACKED_TYPES tests passed`, exit code 0.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add lib/documents/review.ts lib/documents/review.test.ts
git commit -m "Track QM in the annual-review workflow (mirrors Manual)"
```

---

### Task 7: Consolidate `revision-history-pdf.ts` onto the shared label

**Files:**
- Modify: `lib/documents/revision-history-pdf.ts:57-67` (delete local `TYPE_LABELS`), `:1-6` (imports), `:223` (usage)

**Interfaces:**
- Consumes: `TYPE_LABEL` from `@/lib/documents/type-labels` (Task 1).
- Produces: nothing new.

- [ ] **Step 1: Remove the local TYPE_LABELS map and import the shared one**

Add to the imports at the top of `lib/documents/revision-history-pdf.ts` (after the existing `import { supabaseAdmin } from '@/lib/supabase/admin'` on line 5):
```ts
import { TYPE_LABEL } from '@/lib/documents/type-labels'
```

Delete the local map (currently lines 57-67):
```ts
const TYPE_LABELS: Record<string, string> = {
  QP: 'ระเบียบปฏิบัติ QP',
  WI: 'วิธีปฏิบัติ (WI)',
  Manual: 'คู่มือคุณภาพ (QM)',
  Form: 'แบบฟอร์ม (Form)',
  Policy: 'นโยบาย (Policy)',
  Record: 'บันทึกคุณภาพ (Record)',
  Reference: 'เอกสารอ้างอิง (Reference)',
  'Card file': 'Card file',
  Others: 'เอกสารอื่นๆ',
}
```
(This deletion also fixes a preexisting bug: this map incorrectly labeled `Manual` as "คู่มือคุณภาพ (QM)" — that label now correctly belongs to the new `QM` type via the shared `TYPE_LABEL`.)

- [ ] **Step 2: Update the usage site**

Change line 223 from:
```ts
  drawCentered(page, `ประเภทเอกสาร ${TYPE_LABELS[doc.type] ?? doc.type}`, x, A4.height - mm(32), width, fonts.regular, 12)
```
to:
```ts
  drawCentered(page, `ประเภทเอกสาร ${TYPE_LABEL[doc.type] ?? doc.type}`, x, A4.height - mm(32), width, fonts.regular, 12)
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add lib/documents/revision-history-pdf.ts
git commit -m "Consolidate revision-history-pdf.ts onto the shared TYPE_LABEL (fixes stale Manual/QM mislabel)"
```

---

### Task 8: Consolidate `CategoriesClient.tsx` onto the shared label

**Files:**
- Modify: `app/(protected)/staff/documents/categories/CategoriesClient.tsx:1-11` (imports), `:33-47` (constants)

**Interfaces:**
- Consumes: `DOC_TYPES` (as `TYPE_ORDER`) and `TYPE_LABEL` from `@/lib/documents/type-labels` (Task 1).
- Produces: nothing new.

- [ ] **Step 1: Add the import**

Add to the imports (after `import type { Document } from '@/lib/supabase/types'` on line 10):
```ts
import { DOC_TYPES as TYPE_ORDER, TYPE_LABEL } from '@/lib/documents/type-labels'
```

- [ ] **Step 2: Remove the local TYPE_ORDER/TYPE_LABEL, update local icon colors**

Change (current lines 33-47):
```ts
const TYPE_ORDER = ['QP', 'WI', 'Form', 'Policy', 'Manual', 'Record', 'Reference', 'Card file', 'Others']
const TYPE_LABEL: Record<string, string> = {
  QP: 'ระเบียบปฏิบัติ (QP)', WI: 'วิธีปฏิบัติงาน (WI)', Form: 'แบบฟอร์ม (Form)',
  Policy: 'นโยบาย (Policy)', Manual: 'คู่มือ (Manual)', Record: 'บันทึกคุณภาพ (Record)',
  Reference: 'เอกสารอ้างอิง (Reference)', 'Card file': 'เอกสารประกอบการปฏิบัติงาน (Card file)', Others: 'เอกสารอื่นๆ',
}
const TYPE_ICON_BG: Record<string, string> = {
  QP: 'rgba(30,95,173,.10)', WI: 'rgba(13,148,136,.10)', Form: 'rgba(147,51,234,.10)',
  Policy: 'rgba(217,119,6,.10)', Manual: 'rgba(22,163,74,.10)',
  Record: 'rgba(100,116,139,.10)', Reference: 'rgba(234,88,12,.10)', 'Card file': 'rgba(245,158,11,.10)', Others: 'rgba(100,116,139,.10)',
}
const TYPE_ICON_FG: Record<string, string> = {
  QP: '#1E5FAD', WI: '#0D9488', Form: '#9333EA',
  Policy: '#D97706', Manual: '#16A34A', Record: '#64748B', Reference: '#EA580C', 'Card file': '#F59E0B', Others: '#64748B',
}
```
to:
```ts
const TYPE_ICON_BG: Record<string, string> = {
  QP: 'rgba(30,95,173,.10)', WI: 'rgba(13,148,136,.10)', Form: 'rgba(147,51,234,.10)',
  Policy: 'rgba(217,119,6,.10)', Manual: 'rgba(22,163,74,.10)', QM: 'rgba(5,150,105,.10)',
  Reference: 'rgba(234,88,12,.10)', 'Card file': 'rgba(245,158,11,.10)', Lb: 'rgba(79,70,229,.10)', Others: 'rgba(100,116,139,.10)',
}
const TYPE_ICON_FG: Record<string, string> = {
  QP: '#1E5FAD', WI: '#0D9488', Form: '#9333EA',
  Policy: '#D97706', Manual: '#16A34A', QM: '#059669', Reference: '#EA580C', 'Card file': '#F59E0B', Lb: '#4F46E5', Others: '#64748B',
}
```
(`TYPE_ORDER` and `TYPE_LABEL` are now the imported versions; every other reference to them elsewhere in this file — the `TYPE_ORDER.map(...)` render loop and the `TYPE_LABEL[type] ?? type` at what was line 209 — needs no further edit since the imported names are identical.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors from this file. If `TYPE_ORDER` or `TYPE_LABEL` show as unused-import or undefined errors, search the file for any other local shadowing declaration and remove it.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/staff/documents/categories/CategoriesClient.tsx"
git commit -m "Consolidate CategoriesClient.tsx onto the shared type label/order"
```

---

### Task 9: Consolidate `dashboard/page.tsx` onto the shared label

**Files:**
- Modify: `app/(protected)/staff/documents/dashboard/page.tsx:1-9` (imports), `:30-35` (constants)

**Interfaces:**
- Consumes: `DOC_TYPES` (as `TYPE_ORDER`) and `TYPE_LABEL` from `@/lib/documents/type-labels` (Task 1).
- Produces: nothing new.

- [ ] **Step 1: Add the import**

Add to the imports (after `import { Icon } from '@/components/ui/Icon'`):
```ts
import { DOC_TYPES as TYPE_ORDER, TYPE_LABEL } from '@/lib/documents/type-labels'
```

- [ ] **Step 2: Remove the local constants**

Delete (current lines 30-35):
```ts
const TYPE_ORDER = ['QP', 'WI', 'Form', 'Policy', 'Manual', 'Record', 'Reference', 'Card file', 'Others']
const TYPE_LABEL: Record<string, string> = {
  QP: 'ระเบียบปฏิบัติ (QP)', WI: 'วิธีปฏิบัติงาน (WI)', Form: 'แบบฟอร์ม (Form)',
  Policy: 'นโยบาย (Policy)', Manual: 'คู่มือ (Manual)', Record: 'บันทึกคุณภาพ (Record)',
  Reference: 'เอกสารอ้างอิง (Reference)', 'Card file': 'Card file', Others: 'อื่นๆ',
}
```
(No replacement needed here — the import from Step 1 supplies both names directly.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/staff/documents/dashboard/page.tsx"
git commit -m "Consolidate documents dashboard onto the shared type label/order"
```

---

### Task 10: Update `DocumentsClient.tsx` — filter tabs, colors, TYPE_TABS

**Files:**
- Modify: `app/(protected)/staff/documents/DocumentsClient.tsx` (imports near top), `:27` (`TYPE_TABS`), `:31-33` (`TYPE_COLORS`), `:1018` (filter `<select>` options)

**Interfaces:**
- Consumes: `TYPE_LABEL` from `@/lib/documents/type-labels` (Task 1). (`TYPE_TABS` stays locally defined here since it includes the `'All'` sentinel value that isn't part of `DOC_TYPES`.)
- Produces: nothing new.

- [ ] **Step 1: Add the import**

Add near the top imports:
```ts
import { TYPE_LABEL } from '@/lib/documents/type-labels'
```

- [ ] **Step 2: Update TYPE_TABS and TYPE_COLORS**

Change line 27 from:
```ts
const TYPE_TABS = ['All', 'QP', 'WI', 'Form', 'Policy', 'Manual', 'Record', 'Reference', 'Card file', 'Others'] as const
```
to:
```ts
const TYPE_TABS = ['All', 'QP', 'WI', 'Form', 'Policy', 'Manual', 'QM', 'Reference', 'Card file', 'Lb', 'Others'] as const
```

Change lines 31-33 from:
```ts
const TYPE_COLORS: Record<string, 'blue' | 'teal' | 'purple' | 'amber' | 'green' | 'gray' | 'red'> = {
  QP: 'blue', WI: 'teal', Form: 'purple', Policy: 'amber', Manual: 'green', Record: 'gray', Reference: 'red', 'Card file': 'amber', Others: 'gray',
}
```
to:
```ts
const TYPE_COLORS: Record<string, 'blue' | 'teal' | 'purple' | 'amber' | 'green' | 'gray' | 'red'> = {
  QP: 'blue', WI: 'teal', Form: 'purple', Policy: 'amber', Manual: 'green', QM: 'green', Reference: 'red', 'Card file': 'amber', Lb: 'purple', Others: 'gray',
}
```

- [ ] **Step 3: Show full labels in the type filter dropdown**

Change line 1018 from:
```tsx
              {TYPE_TABS.filter(t => t !== 'All').map((t) => <option key={t} value={t}>{t}</option>)}
```
to:
```tsx
              {TYPE_TABS.filter(t => t !== 'All').map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
```

Leave the table badge at line 1195 (`<Badge color={TYPE_COLORS[doc.type] ?? 'gray'} size="sm">{doc.type}</Badge>`) unchanged — per the global constraint, compact table badges keep the bare code.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/staff/documents/DocumentsClient.tsx"
git commit -m "Add QM/Lb to DocumentsClient filters, show full labels in type filter dropdown"
```

---

### Task 11: Update `MasterListClient.tsx` — filter tabs, colors, dot colors

**Files:**
- Modify: `app/(protected)/staff/documents/master-list/MasterListClient.tsx` (imports near top), `:17` (`TYPE_TABS`), `:32-40` (`TYPE_COLORS`/`TYPE_DOT_FG`), `:444-454` (tab buttons)

**Interfaces:**
- Consumes: `TYPE_LABEL` from `@/lib/documents/type-labels` (Task 1).
- Produces: nothing new.

- [ ] **Step 1: Add the import**

Add near the top imports:
```ts
import { TYPE_LABEL } from '@/lib/documents/type-labels'
```

- [ ] **Step 2: Update TYPE_TABS, TYPE_COLORS, TYPE_DOT_FG**

Change line 17 from:
```ts
const TYPE_TABS = ['All', 'QP', 'WI', 'Form', 'Policy', 'Manual', 'Record', 'Reference', 'Card file', 'Others'] as const
```
to:
```ts
const TYPE_TABS = ['All', 'QP', 'WI', 'Form', 'Policy', 'Manual', 'QM', 'Reference', 'Card file', 'Lb', 'Others'] as const
```

Change lines 32-40 from:
```ts
const TYPE_COLORS: Record<string, 'blue' | 'teal' | 'purple' | 'amber' | 'green' | 'gray' | 'red'> = {
  QP: 'blue', WI: 'teal', Form: 'purple', Policy: 'amber', Manual: 'green', Record: 'gray',
  Reference: 'red', 'Card file': 'amber', Others: 'gray',
}
const TYPE_DOT_FG: Record<string, string> = {
  QP: '#1E5FAD', WI: '#0D9488', Form: '#9333EA',
  Policy: '#D97706', Manual: '#16A34A', Record: '#64748B',
  Reference: '#EA580C', 'Card file': '#F59E0B', Others: '#64748B',
}
```
to:
```ts
const TYPE_COLORS: Record<string, 'blue' | 'teal' | 'purple' | 'amber' | 'green' | 'gray' | 'red'> = {
  QP: 'blue', WI: 'teal', Form: 'purple', Policy: 'amber', Manual: 'green', QM: 'green',
  Reference: 'red', 'Card file': 'amber', Lb: 'purple', Others: 'gray',
}
const TYPE_DOT_FG: Record<string, string> = {
  QP: '#1E5FAD', WI: '#0D9488', Form: '#9333EA',
  Policy: '#D97706', Manual: '#16A34A', QM: '#059669',
  Reference: '#EA580C', 'Card file': '#F59E0B', Lb: '#4F46E5', Others: '#64748B',
}
```

- [ ] **Step 3: Show full labels on the filter tab buttons**

Change lines 444-454 from:
```tsx
        {TYPE_TABS.map(t => (
          <button key={t} onClick={() => { setActiveType(t); setPage(0) }} style={{
            padding: '5px 14px', borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, transition: 'all .15s',
            background: activeType === t ? 'var(--surface-2)' : 'transparent',
            color: activeType === t ? 'var(--ink)' : 'var(--muted)',
            fontWeight: activeType === t ? 700 : 500,
          }}>
            {t}
          </button>
        ))}
```
to:
```tsx
        {TYPE_TABS.map(t => (
          <button key={t} onClick={() => { setActiveType(t); setPage(0) }} style={{
            padding: '5px 14px', borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, transition: 'all .15s',
            background: activeType === t ? 'var(--surface-2)' : 'transparent',
            color: activeType === t ? 'var(--ink)' : 'var(--muted)',
            fontWeight: activeType === t ? 700 : 500,
          }}>
            {t === 'All' ? t : (TYPE_LABEL[t] ?? t)}
          </button>
        ))}
```

Leave the table badge at line 528 (`<Badge color={TYPE_COLORS[doc.type] ?? 'gray'} size="sm">{doc.type}</Badge>`) unchanged.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/staff/documents/master-list/MasterListClient.tsx"
git commit -m "Add QM/Lb to MasterListClient filters, show full labels on filter tabs"
```

---

### Task 12: Update `ManualClient.tsx` (public page) — add QM/Lb tabs

**Files:**
- Modify: `app/(public)/manual/ManualClient.tsx:1-16` (imports + constants), `:55-73` (tab buttons)

**Interfaces:**
- Consumes: `TYPE_LABEL` from `@/lib/documents/type-labels` (Task 1).
- Produces: nothing new.

- [ ] **Step 1: Add the import**

Add after the existing `import type { Document } from '@/lib/supabase/types'`:
```ts
import { TYPE_LABEL } from '@/lib/documents/type-labels'
```

- [ ] **Step 2: Update TYPE_TABS and TYPE_COLORS**

Change line 13 from:
```ts
const TYPE_TABS = ['All', 'QP', 'WI', 'Form', 'Policy', 'Manual', 'Record', 'Others'] as const
```
to:
```ts
const TYPE_TABS = ['All', 'QP', 'WI', 'Form', 'Policy', 'Manual', 'QM', 'Lb', 'Others'] as const
```
(Per the design decision, only `QM`/`Lb` are added here and `Record` is dropped. This page's existing omission of `Reference`/`Card file` is a pre-existing gap, left untouched — out of scope for this change.)

Change lines 14-16 from:
```ts
const TYPE_COLORS: Record<string, 'blue' | 'teal' | 'purple' | 'amber' | 'green' | 'gray'> = {
  QP: 'blue', WI: 'teal', Form: 'purple', Policy: 'amber', Manual: 'green', Record: 'gray', Others: 'gray',
}
```
to:
```ts
const TYPE_COLORS: Record<string, 'blue' | 'teal' | 'purple' | 'amber' | 'green' | 'gray'> = {
  QP: 'blue', WI: 'teal', Form: 'purple', Policy: 'amber', Manual: 'green', QM: 'green', Lb: 'purple', Others: 'gray',
}
```

- [ ] **Step 3: Show full labels on the tab buttons**

Change lines 55-73 (the `TYPE_TABS.map` block) from:
```tsx
        {TYPE_TABS.map((tab) => {
          const count = tab === 'All' ? docs.length : docs.filter((d) => d.type === tab).length
          if (tab !== 'All' && count === 0) return null
          return (
            <button
              key={tab}
              onClick={() => setActiveType(tab)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 600,
                background: activeType === tab ? 'var(--primary)' : 'var(--surface-2)',
                color: activeType === tab ? '#fff' : 'var(--ink)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {tab} ({count})
            </button>
          )
        })}
```
to:
```tsx
        {TYPE_TABS.map((tab) => {
          const count = tab === 'All' ? docs.length : docs.filter((d) => d.type === tab).length
          if (tab !== 'All' && count === 0) return null
          return (
            <button
              key={tab}
              onClick={() => setActiveType(tab)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 600,
                background: activeType === tab ? 'var(--primary)' : 'var(--surface-2)',
                color: activeType === tab ? '#fff' : 'var(--ink)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {tab === 'All' ? tab : (TYPE_LABEL[tab] ?? tab)} ({count})
            </button>
          )
        })}
```

Leave the badge at line 96 (`<Badge color={TYPE_COLORS[doc.type] ?? 'gray'} size="sm">{doc.type}</Badge>`) unchanged.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/manual/ManualClient.tsx"
git commit -m "Add QM/Lb tabs to the public manual page"
```

---

### Task 13: Update `ReadReportClient.tsx` — sync TYPE_ORDER

**Files:**
- Modify: `app/(protected)/staff/documents/read-report/ReadReportClient.tsx:8` (imports), `:40` (`TYPE_ORDER`)

**Interfaces:**
- Consumes: `DOC_TYPES` (as `TYPE_ORDER`) from `@/lib/documents/type-labels` (Task 1). `TYPE_ICON_BG`/`TYPE_ICON_FG` are unchanged imports from `@/lib/documents/ui-constants` — those already picked up `QM`/`Lb` from Task 5.
- Produces: nothing new.

- [ ] **Step 1: Update the import line**

Change line 8 from:
```ts
import { TYPE_ICON_BG, TYPE_ICON_FG } from '@/lib/documents/ui-constants'
```
to:
```ts
import { TYPE_ICON_BG, TYPE_ICON_FG } from '@/lib/documents/ui-constants'
import { DOC_TYPES as TYPE_ORDER } from '@/lib/documents/type-labels'
```

- [ ] **Step 2: Remove the local TYPE_ORDER**

Delete line 40:
```ts
const TYPE_ORDER = ['QP', 'WI', 'Form', 'Policy', 'Manual', 'Record', 'Reference', 'Card file', 'Others']
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (`TYPE_ORDER` usage at what was line 149, `TYPE_ORDER.filter((t) => rows.some((r) => r.type === t))`, needs no change — the imported name is identical, and the display at line 414 stays a bare-code pill, unchanged, per the compact-cell constraint.)

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/staff/documents/read-report/ReadReportClient.tsx"
git commit -m "Sync ReadReportClient type order with the shared DOC_TYPES list"
```

---

### Task 14: Update the current-revision API route's type allow-list

**Files:**
- Modify: `app/api/admin/documents/[id]/current-revision/route.ts:1-4` (imports), `:47` (`DOCUMENT_TYPES`)

**Interfaces:**
- Consumes: `DOC_TYPES` from `@/lib/documents/type-labels` (Task 1).
- Produces: nothing new.

- [ ] **Step 1: Add the import**

Add to the top imports (this file currently starts with `import { NextRequest, NextResponse } from 'next/server'` — add after any existing imports):
```ts
import { DOC_TYPES } from '@/lib/documents/type-labels'
```

- [ ] **Step 2: Derive DOCUMENT_TYPES from the shared list**

Change line 47 from:
```ts
const DOCUMENT_TYPES = new Set(['QP', 'WI', 'Form', 'Policy', 'Manual', 'Record', 'Reference', 'Card file', 'Others'])
```
to:
```ts
const DOCUMENT_TYPES = new Set<string>(DOC_TYPES)
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add "app/api/admin/documents/[id]/current-revision/route.ts"
git commit -m "Derive current-revision route's type allow-list from the shared DOC_TYPES"
```

---

### Task 15: Run the DB migration and do a full manual verification pass

**Files:** none (verification only)

**Interfaces:**
- Consumes: everything from Tasks 1-14.
- Produces: nothing (terminal task).

- [ ] **Step 1: Run the DB migration**

Open Supabase Dashboard > SQL Editor, paste and run `scripts/add-document-types-quality-manual-logbook.sql` from Task 3, one statement block at a time, in order (STEP 1 preview → STEP 2 constraint update → STEP 3 data update → STEP 4 confirm). Confirm STEP 1's preview returns exactly the `QM-LAB-01` row before running STEP 2/3, and confirm STEP 4 returns 0 rows afterward. This step must be run by a human with Supabase Dashboard access — the app only has a PostgREST-based Supabase client (no direct Postgres connection), which cannot execute `ALTER TABLE` DDL.

- [ ] **Step 2: Full type-check**

Run: `npx tsc --noEmit`
Expected: zero output, zero errors, across the whole project.

- [ ] **Step 3: Full production build**

Run: `npx next build`
Expected: build completes successfully with no errors (matches the verification approach used for the earlier risk-date-fix work in this repo).

- [ ] **Step 4: Manual smoke test**

Run `npm run dev` and check, logged in as a role with document-management access:
1. `/staff/documents` — type filter dropdown shows full "Name (Code)" labels including "คู่มือคุณภาพ (QM)" and "สมุดบันทึก (Lb)"; the document table's type badge still shows the bare code.
2. Upload/edit modal — the "ประเภทเอกสาร" dropdown shows full labels for all 10 types, no `Record` option.
3. `/staff/documents/master-list` — filter tabs show full labels; table badges show bare codes.
4. `/staff/documents/categories` — category group headers show full labels; `QM-LAB-01` now appears grouped under "คู่มือคุณภาพ (QM)", not "คู่มือ (MN)".
5. `/staff/documents/dashboard` — the "เอกสารแยกตามประเภท" bar list shows full labels; the QM bar shows count ≥ 1.
6. `/manual` (public, logged out) — QM and Lb tabs appear once at least one document of that type is Published; `QM-LAB-01` appears under the QM tab once published.
7. `/staff/documents/read-report` — type pills still show bare codes, grouped in the new type order.
8. Try uploading a document with code `QM-LAB-99` — confirm it auto-selects type "คู่มือคุณภาพ (QM)" in the dropdown (not "คู่มือ (MN)").
9. Try uploading a document with code `LB-LAB-01` — confirm it auto-selects type "สมุดบันทึก (Lb)".

- [ ] **Step 5: Run all test files**

```bash
npx tsx lib/documents/type-labels.test.ts
npx tsx lib/documents/review.test.ts
```
Expected: both print their success message, exit code 0.

- [ ] **Step 6: Final commit (if any manual-test fixes were needed)**

```bash
git status
# If clean, nothing to commit — Tasks 1-14 already captured everything.
# If manual testing surfaced a fix, commit it here with a message describing what was found.
```
