# Add QM/Lb document types + consolidate type labels

**Date:** 2026-07-11
**Status:** Approved (design questions resolved via conversation, see decisions below)

## Problem

1. Two new document types are needed: **Quality Manual (QM)** and **Log book (Lb)**.
2. Wherever a document type is shown as text (filters, dropdowns, category headers, dashboards),
   it should read "Full name (Code)" — but the "full name (code)" pairing is currently
   copy-pasted across 4+ files with inconsistent Thai wording (e.g. `Others` is "อื่นๆ" in one
   file and "เอกสารอื่นๆ" in another), and several surfaces (the create/edit type dropdown, the
   master-list badge, the public manual page) show only a bare code with no name at all.

## Current state (as found)

- The `documents.type` column already mixes short codes (`QP`, `WI`) and full words (`Form`,
  `Policy`, `Manual`, `Record`, `Reference`, `Card file`, `Others`) — 9 values today, enforced by
  a Postgres CHECK constraint (`scripts/add-document-types-reference-cardfile.sql`).
- Document *codes* (e.g. `QM-LAB-01`, `MN-LAB-02`) use a **separate** prefix system
  (`DocumentUploadModal.tsx` `TYPE_BY_PREFIX`) that auto-detects `type` from the code prefix.
  Today both `QM-` and `MN-` prefixes map to the same `type: 'Manual'` — there is no distinct
  Quality Manual bucket yet.
- `type=Record` has **0 documents** using it currently — safe to remove outright.
- Exactly **one** existing document (`QM-LAB-01`, "คู่มือคุณภาพกลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี") is
  the real quality manual, currently misfiled as `type=Manual`. The other two `Manual` documents
  are `MN-`-prefixed and correctly generic manuals.
- Full-name+code label maps are duplicated (not identical) in: `CategoriesClient.tsx`,
  `dashboard/page.tsx`, `lib/documents/workflow.ts` (`DOCUMENT_TYPE_LABELS`, unused dead code —
  cover-page generation is disabled), and `lib/documents/revision-history-pdf.ts`
  (`TYPE_LABELS`, which today incorrectly labels `Manual` as "คู่มือคุณภาพ (QM)" — a preexisting
  bug this change fixes by moving that label to the new `QM` type where it belongs).
- `lib/documents/review.ts` has business logic (`REVIEW_TRACKED_TYPES = ['QP','WI','Manual']`)
  that gates the annual-review workflow — `QM-LAB-01` currently participates in that workflow via
  `Manual`; this must not silently drop when it moves to `QM`.

## Decisions

| Question | Decision |
|---|---|
| Should `QM`-prefixed docs split into a distinct new type, or stay bucketed with `Manual`? | **Split.** New `QM` type. One-time data migration moves the existing `QM-LAB-01` row from `type=Manual` to `type=QM`. `MN`-prefixed docs stay `type=Manual`. |
| Storage format for the 2 new type values | Short codes: `'QM'`, `'Lb'` — matching the existing `QP`/`WI` precedent. Existing type values (`Form`, `Policy`, `Manual`, `Reference`, `Card file`) are **not** renamed. |
| Consolidate the duplicated label maps? | **Yes** — one shared source, `lib/documents/type-labels.ts`. |
| Language of the consolidated label | **Keep existing Thai names**, just append `(Code)` consistently — not the English names the user listed (those map 1:1 to the codes, not a language switch). |
| `Policy` display code | `(CBH)` — new code, not previously used anywhere in the system. |
| `Card file` Thai name | "เอกสารประกอบการปฏิบัติงาน (Cf)" |
| `Log book` Thai name | "สมุดบันทึก (Lb)" |
| `Record` type | **Removed entirely** (0 documents affected). Dropped from `DOC_TYPES`, the CHECK constraint, and every filter/dropdown. |
| `Others` | Stays with **no** code suffix — "เอกสารอื่นๆ" (matches the user's original list, which omitted a code for Others). |
| Public `/manual` page | Add both `QM` and `Lb` tabs. (Note: that page's tab list already omits `Reference`/`Card file` — left as-is, out of scope.) |
| Annual review workflow | `QM` **is** added to `REVIEW_TRACKED_TYPES` (mirrors `Manual`'s current inclusion), so `QM-LAB-01` keeps being tracked after the migration. |
| Compact table/badge cells (MasterListClient, DocumentsClient library table, ManualClient public badge) | **Keep showing the bare code only** (no name) — unchanged from today. Only filters, dropdowns, category headers, and dashboards switch to "Name (Code)". |

## Final type list (10 values)

| `type` (DB, unchanged unless noted) | Label (Thai name + code) |
|---|---|
| `QP` | ระเบียบปฏิบัติ (QP) |
| `WI` | วิธีปฏิบัติงาน (WI) |
| `Form` | แบบฟอร์ม (Fm) |
| `Policy` | นโยบาย (CBH) |
| `Manual` | คู่มือ (MN) |
| `QM` **(new)** | คู่มือคุณภาพ (QM) |
| `Reference` | เอกสารอ้างอิง (Rf) |
| `Card file` | เอกสารประกอบการปฏิบัติงาน (Cf) |
| `Lb` **(new)** | สมุดบันทึก (Lb) |
| `Others` | เอกสารอื่นๆ |
| ~~`Record`~~ | removed |

## Architecture

**New file `lib/documents/type-labels.ts`** — single source of truth:
```ts
export const DOC_TYPES = ['QP','WI','Form','Policy','Manual','QM','Reference','Card file','Lb','Others'] as const
export const TYPE_LABEL: Record<string, string> = { /* table above */ }
```
Every file that currently defines its own `TYPE_ORDER`/`TYPE_LABEL`/`DOC_TYPES`/`TYPE_LABELS`
imports from here instead. Per-file color maps (`TYPE_ICON_BG`/`FG`, `TYPE_COLORS`) are a
separate, unrelated concern — left where they are, just extended with `QM`/`Lb` entries and with
`Record` removed.

**Database migration** — new file `scripts/add-document-types-quality-manual-logbook.sql`:
1. Preview: `select id, document_code, type from documents where type = 'Manual' and document_code ilike 'QM-%'` (expect exactly the one row).
2. `update documents set type = 'QM' where document_code = 'QM-LAB-01' and type = 'Manual';`
3. Drop and recreate `documents_type_check`: `CHECK (type IN ('QP','WI','Form','Policy','Manual','QM','Reference','Card file','Lb','Others'))`.
4. Run manually in Supabase SQL Editor per this repo's existing convention (no migration runner).

**Files to change** (label/type-list consumers):
`lib/validations/document.ts`, `lib/supabase/types.ts`,
`app/api/admin/documents/[id]/current-revision/route.ts`,
`components/documents/DocumentUploadModal.tsx` (prefix map gets `QM: 'QM'` replacing
`QM: 'Manual'`, adds `LB: 'Lb'`; type `<select>` renders `TYPE_LABEL[t]` instead of the bare
code), `app/(protected)/staff/documents/categories/CategoriesClient.tsx`,
`app/(protected)/staff/documents/dashboard/page.tsx`,
`app/(protected)/staff/documents/DocumentsClient.tsx` (filter tabs get full labels; table badge
stays bare code), `app/(protected)/staff/documents/master-list/MasterListClient.tsx` (filter tabs
get full labels; table badge stays bare code), `app/(public)/manual/ManualClient.tsx` (adds
QM/Lb tabs), `lib/documents/ui-constants.ts`, `lib/documents/review.ts` (add `QM` to
`REVIEW_TRACKED_TYPES`), `lib/documents/revision-history-pdf.ts` (drop local `TYPE_LABELS`,
import shared one — also fixes the existing Manual/QM mislabel), `ReadReportClient.tsx`,
`PendingClient.tsx`, `DocumentDetailModal.tsx`.

`lib/documents/workflow.ts`'s `DOCUMENT_TYPE_LABELS` is dead code (cover-page generation is
disabled via `COVER_GENERATION_ENABLED = false`) — left as-is, not worth touching for this change.

## Testing

No existing test file covers this module. Given the project's established pattern (plain
`node:assert` scripts run via `tsx`, see `lib/risk-utils.test.ts`), add
`lib/documents/type-labels.test.ts` covering: every `DOC_TYPES` entry has a `TYPE_LABEL` entry,
`Record` is absent, `QM`/`Lb` are present with the expected strings. Everything else in this
change is UI wiring and a data migration — verified manually via `npm run dev` (upload modal
dropdown, filters on all 3 document list pages, public `/manual` page) plus `tsc --noEmit` and
`next build`, consistent with how the risk-date-fix work was verified.
