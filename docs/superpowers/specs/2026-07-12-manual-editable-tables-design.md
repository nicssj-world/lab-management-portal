# Manual — Data-Driven Editable Tables

**Date:** 2026-07-12
**Status:** Design approved (pending written-spec review)
**Area:** `app/(public)/manual/`

## Problem

The lab manual (`/manual`) has two ways to edit content:

1. **Code** — rich React section components (`sections/Manual*.tsx`) own layout and data.
2. **"แก้ไขเนื้อหา" WYSIWYG** — saves an HTML override into `manual_sections.body_html_th/en`; when present it fully replaces the React component for that section.

These two paths conflict. The moment a non-static section is saved via WYSIWYG, the app renders the frozen HTML snapshot and ignores the React component, so later code changes are invisible until someone clicks "ล้าง → ใช้เนื้อหาต้นฉบับ" (which throws away the manual edits). Editing structured tables inside `contentEditable` is also fragile and drifts from the code styling.

Non-IT lab staff need to edit the manual's **tables** (data that changes periodically) without touching code and without the freeze trap.

## Goals

- Let non-IT users edit manual **table data** (add/edit/delete/reorder rows) through a safe UI, with the **exact same rendered appearance** as today.
- Keep layout/styling owned by the React components — users cannot break the layout.
- One reusable mechanism that works for every manual table (current and future), not per-table bespoke code.
- Match the existing "แก้ไขเนื้อหา" UX: **inline editing in the page**, **Bold button** (not markdown), TH/EN language tabs.
- Negligible DB impact.

## Non-Goals

- Not replacing the WYSIWYG editor — prose sections keep using it.
- Not making the table **structure/columns** user-editable (columns are defined in code).
- Not building EN content that doesn't already exist (e.g. retention duration stays TH-only, matching current code).
- No per-edit history/versioning of table data.

## Architecture Overview

Separate **data** (rows, in DB) from **layout** (React component, in code). The component keeps rendering exactly as now; it just sources its row array from the DB when present, else from the in-code default array.

```
manual/page.tsx (server)
  └─ fetch manual_sections (body_html_*  +  table_data)
       └─ ManualShell (client)  ── provides ManualTablesContext ──┐
            └─ section components (ManualAddon, ...)              │
                 └─ useManualTable('retention', DEFAULT_RETENTION)
                      → rows = DB rows ?? DEFAULT_RETENTION       │
                      → render existing JSX (unchanged look)      │
                      → canEdit ? show "แก้ตาราง" → inline editor ┘
                          └─ save → PATCH /api/admin/manual/[id] { table_data }
```

## Data Model

Extend the existing table — no new table:

```sql
-- scripts/add-manual-table-data.sql  (run manually in Supabase SQL Editor)
ALTER TABLE manual_sections ADD COLUMN IF NOT EXISTS table_data jsonb;
```

- Shape: `table_data = { [tableId]: Row[] }`. One section may hold several tables (addon holds `retention` + `addonLimits`).
- `Row` is an object keyed by the table schema's column keys.
- Overwrite-in-place on save; row count in DB stays constant (~10 section rows). Estimated total size across all manual tables: ~20–40 KB.

## Table Schema (in code)

Each editable table is declared once, e.g. in `manual/tables.ts`:

```ts
type ColumnKind = 'text' | 'lines'
interface Column {
  key: string          // matches the field key the component reads
  label: string        // shown in the editor
  kind: ColumnKind     // 'text' = single-line string; 'lines' = string[] of inline HTML
  lang?: 'th' | 'en'   // omitted = language-agnostic (e.g. emoji); else shown only on that lang tab
}
interface TableSchema { id: string; sectionId: string; title: string; columns: Column[] }
```

Example (retention, TH-only duration):

```ts
{ id: 'retention', sectionId: 'addon', title: 'ระยะเวลาเก็บสิ่งตัวอย่างหลังการตรวจวิเคราะห์', columns: [
  { key: 'emoji',     label: 'ไอคอน', kind: 'text' },
  { key: 'sectionTh', label: 'งาน',   kind: 'text', lang: 'th' },
  { key: 'sectionEn', label: 'Section',kind: 'text', lang: 'en' },
  { key: 'durationTh',label: 'ระยะเวลาเก็บ', kind: 'lines' },   // language-agnostic (matches current code)
]}
```

`addonLimits` is all `kind: 'text'`, with `lang`-tagged Th/En columns (`sectionTh/En`, `examplesTh/En`, `limitTh/En`) plus `emoji`.

### Field value shapes

- `text` → `string` (plain, single line).
- `lines` → `string[]`, each entry is **inline HTML** limited to `<strong>`/`<em>`/`<br>`. The component renders each entry with a `:` prefix via `dangerouslySetInnerHTML` (visually identical to today's multi-line + bold cells).

## Reusable Inline Editor

`components/manual/ManualTableEditor.tsx` (client). Reuses existing UI conventions (inline styles + CSS vars, toast, `sanitizeRichHtml`, the same `execCommand('bold')` toolbar pattern as ManualShell).

Behaviour:
- Rendered **inline in place of the table** when the user clicks "แก้ตาราง" (mirrors ManualShell edit mode — bordered primary block, not a modal).
- **TH/EN language tabs** at the top (only shown if the schema has any `lang`-tagged columns). Tab filters which columns are shown: a column shows when `!column.lang || column.lang === editLang`.
- One editable row block per data row, with:
  - `text` column → plain `<input>`.
  - `lines` column → a list of single-line **contentEditable** boxes (one per line) each with a **Bold (B)** button; "＋ เพิ่มบรรทัด" / delete-line controls.
  - Row controls: move up / move down / delete row.
- "＋ เพิ่มแถว" adds an empty row.
- On first open with no DB rows for this table, **seed the editor from the in-code default array** (so the user starts from current content), matching how WYSIWYG seeds from the static snapshot.
- Footer: บันทึก (save) · ยกเลิก (cancel) · "ล้าง → ใช้ค่าต้นฉบับ" (delete this table's `table_data`, revert to code default).
- On save: sanitize `lines` HTML client-side, `PATCH /api/admin/manual/[sectionId]` with `{ table_data: { [tableId]: rows } }` (merged server-side with the section's other tables).

## Read Path

`useManualTable<T>(tableId, sectionId, defaultRows: T[])` (client hook, reads `ManualTablesContext`):

```ts
const { rows, canEdit } = useManualTable('retention', 'addon', DEFAULT_RETENTION)
```

- `rows` = DB rows for this table if present & non-empty, else `defaultRows`.
- Section components keep their existing render JSX; only the source array changes. `durationTh` default values change from `ReactNode[]` (JSX `<strong>`) to `string[]` of inline HTML — rendered via `dangerouslySetInnerHTML` with a scoped CSS rule making `strong` use `var(--ink)` to match today's bold styling exactly.
- Context is provided by ManualShell from the server-fetched `table_data`; after a save the editor updates context locally (optimistic, like `localSections`).

## API

Extend `app/api/admin/manual/[id]/route.ts`:
- **GET** — add `table_data` to the select.
- **PATCH** — accept optional `table_data` (partial: `{ [tableId]: Row[] }`). Merge into the existing row's `table_data` (don't clobber sibling tables). Sanitize every `lines`/rich value server-side with an **inline** sanitizer (allow only `<strong>`/`<em>`/`<br>`). Permission unchanged: `['Admin','Manager']`. Keep the existing `body_html_*` handling intact so a PATCH can carry either/both.
- Reuse the existing `audit_log` fire-and-forget insert (`action: 'manual_edit'`).

Server page (`page.tsx`): add `table_data` to the `manual_sections` select and pass a `dbTables: Record<sectionId, Record<tableId, Row[]>>` prop into ManualShell.

## Sanitization / Security

- Add an inline-only mode to `lib/html-sanitize.ts` (or a sibling helper) that strips everything except `<strong>`, `<em>`, `<br>`. Applied both client-side (before PATCH) and server-side (in the route) — server is the authority.
- Rows are rendered via `dangerouslySetInnerHTML` only for sanitized `lines` values; all layout/structure stays in JSX.

## Guard-Rail Banner (from approach C)

In ManualShell **view mode**, when the active section has a WYSIWYG override (`hasCustomContent`) and `canEdit`, show a small info banner:

> "หน้านี้กำลังแสดงเนื้อหาที่แก้เอง — การอัปเดตจากระบบจะไม่ปรากฏจนกว่าจะกด 'ล้าง → ใช้เนื้อหาต้นฉบับ'"

Cheap safety net that prevents the exact confusion that triggered this work. Independent of the table feature.

## Scope

**Iteration 1 (this spec's build):**
1. `scripts/add-manual-table-data.sql` (add column).
2. `manual/tables.ts` schema types + retention & addonLimits schemas.
3. Inline sanitizer mode in `lib/html-sanitize.ts`.
4. `ManualTableEditor` component + `useManualTable` hook + `ManualTablesContext`.
5. Extend manual GET/PATCH route + `page.tsx` fetch + ManualShell provider.
6. Migrate the two addon tables (retention, addonLimits) to read-from-hook and add "แก้ตาราง" buttons (canEdit only).
7. Guard-rail banner.

**Later iterations (same pattern, out of scope here):** phone directory, team, containers, critical values, outlab tables.

## Testing / Verification

- Automated: `npx tsc --noEmit` (only automated check in this repo).
- Manual (run dev server, `/manual` → addon):
  - Table renders **pixel-identical** to current before any edit (default path).
  - As Admin/Manager: "แก้ตาราง" → edit a cell, add a row, bold a word, reorder, save → persists after reload and renders correctly.
  - "ล้าง → ใช้ค่าต้นฉบับ" reverts to code default.
  - Table data and WYSIWYG override are **independent**: clearing one does not affect the other.
  - Non-editor (logged-out / no canEdit) sees the table read-only with no edit button.
  - EN tab edits only EN columns; TH-only columns (duration) show regardless of tab.

## Risks / Notes

- `lines` inline HTML is the one place row data carries markup; it's sanitized to inline tags only and the component still owns table structure — the freeze failure mode cannot recur.
- Changing retention defaults from `ReactNode[]` to `string[]` is a small refactor of code just written today; visual output is unchanged (verified by the identical-appearance test above).
