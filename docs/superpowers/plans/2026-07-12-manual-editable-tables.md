# Manual Editable Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let non-IT lab staff edit the manual's data tables through a safe inline UI, with the exact same rendered appearance, without the WYSIWYG freeze trap.

**Architecture:** Separate data (rows, in DB `manual_sections.table_data jsonb`) from layout (React components, in code). Each section component sources its row array from the DB when present, else from an in-code default array, and renders it with unchanged JSX. A reusable inline editor (matching the existing "แก้ไขเนื้อหา" UX — inline block, Bold button, TH/EN tabs) writes rows back via the existing manual PATCH route.

**Tech Stack:** Next.js 16 / React 19, Supabase (`supabaseAdmin`), TypeScript, inline styles + CSS vars. No test runner in this repo.

## Global Constraints

- Next.js 16 / React 19: route params are async (`await params`); `createClient()` from `lib/supabase/server` is async.
- No external UI libraries; inline styles only using CSS vars (`var(--ink)`, `var(--border)`, `var(--muted)`, `var(--primary)`, `var(--surface-2)`, `var(--card)`, `var(--primary-soft)`).
- All DB mutations go through `/api/admin/*` routes using `supabaseAdmin`; client components never mutate directly.
- Only automated verification is `npx tsc --noEmit`. There is NO test runner — do not add one. Verify behavior by type-check + driving the dev server in a browser.
- Pre-existing unrelated type errors exist in `scripts/related-quality-documents.test.ts` (missing module). Ignore them; they are not caused by this work. A clean run means no NEW errors in files this plan touches.
- Permission for manual edits: `['Admin','Manager']` (unchanged from the existing route).
- SQL migrations are run manually in Supabase Dashboard → SQL Editor; there is no migration runner.
- Git: repo is on default branch `main`. Create a feature branch before the first commit.

---

## File Structure

- `scripts/add-manual-table-data.sql` — **Create.** Adds the `table_data jsonb` column.
- `lib/html-sanitize.ts` — **Modify.** Add `sanitizeInlineHtml()` (strong/em/br only).
- `app/(public)/manual/tables.ts` — **Create.** Column-schema types + `retention` and `addonLimits` schemas + shared editable-row type.
- `app/(public)/manual/ManualTablesContext.tsx` — **Create.** React context + provider + `useManualTable` hook.
- `components/manual/ManualTableEditor.tsx` — **Create.** Reusable inline table editor.
- `app/api/admin/manual/[id]/route.ts` — **Modify.** GET returns `table_data`; PATCH merges `table_data`.
- `app/(public)/manual/page.tsx` — **Modify.** Fetch `table_data`, pass `dbTables` prop.
- `app/(public)/manual/ManualShell.tsx` — **Modify.** Accept `dbTables`, wrap children in provider, add guard-rail banner.
- `app/(public)/manual/sections/ManualAddon.tsx` — **Modify.** Reshape `durationTh` to `string[]`, read via `useManualTable`, add edit buttons.

---

## Task 1: Add `table_data` column (SQL migration)

**Files:**
- Create: `scripts/add-manual-table-data.sql`

**Interfaces:**
- Produces: column `manual_sections.table_data jsonb` (nullable).

- [ ] **Step 1: Create the SQL script**

`scripts/add-manual-table-data.sql`:
```sql
-- Adds JSON storage for data-driven manual tables.
-- Run manually in Supabase Dashboard -> SQL Editor. Safe to re-run.
ALTER TABLE manual_sections ADD COLUMN IF NOT EXISTS table_data jsonb;
```

- [ ] **Step 2: Run it in Supabase**

Paste the script into Supabase Dashboard → SQL Editor and run. Expected: "Success. No rows returned."

- [ ] **Step 3: Verify the column exists**

Run in SQL Editor:
```sql
select column_name, data_type from information_schema.columns
where table_name = 'manual_sections' and column_name = 'table_data';
```
Expected: one row — `table_data | jsonb`.

- [ ] **Step 4: Commit**

```bash
git add scripts/add-manual-table-data.sql
git commit -m "feat(manual): add table_data column for data-driven tables"
```

---

## Task 2: Inline HTML sanitizer

**Files:**
- Modify: `lib/html-sanitize.ts`

**Interfaces:**
- Produces: `sanitizeInlineHtml(html: string | null | undefined): string` — keeps only `<strong>`, `<em>`, `<br>`; strips all attributes and every other tag; unwraps disallowed tags' text content.

- [ ] **Step 1: Add the function at the end of `lib/html-sanitize.ts`**

```ts
const INLINE_ALLOWED = new Set(['strong', 'em', 'br'])
const INLINE_VOID = new Set(['br'])

/**
 * Strict inline sanitizer for single-cell rich text (manual table cells).
 * Allows only <strong>, <em>, <br>; drops all attributes and other tags
 * (keeping their text). Blocked block-level content is removed entirely.
 */
export function sanitizeInlineHtml(html: string | null | undefined): string {
  if (!html) return ''
  const withoutBlocked = String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option)\b[^>]*>/gi, '')

  return withoutBlocked.replace(/<\s*(\/?)\s*([a-zA-Z0-9-]+)([^>]*)>/g, (_full, closing: string, tagName: string) => {
    const tag = tagName.toLowerCase()
    if (!INLINE_ALLOWED.has(tag)) return ''
    if (closing) return INLINE_VOID.has(tag) ? '' : `</${tag}>`
    return INLINE_VOID.has(tag) ? '<br />' : `<${tag}>`
  })
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (only the pre-existing `scripts/related-quality-documents.test.ts` errors, if any).

- [ ] **Step 3: Spot-check behavior with a throwaway script (not committed)**

Run:
```bash
npx tsx -e "import {sanitizeInlineHtml} from './lib/html-sanitize.ts'; console.log(sanitizeInlineHtml('<strong onclick=x>Anti-HIV</strong> <script>bad()</script><div style=color:red>x</div><br>ok'))"
```
Expected output: `<strong>Anti-HIV</strong> x<br />ok`
(strong kept without attrs, script removed, div unwrapped, br normalized)

- [ ] **Step 4: Commit**

```bash
git add lib/html-sanitize.ts
git commit -m "feat(manual): add strict inline HTML sanitizer"
```

---

## Task 3: Table schemas + shared row type

**Files:**
- Create: `app/(public)/manual/tables.ts`

**Interfaces:**
- Produces:
  - `type ColumnKind = 'text' | 'lines'`
  - `interface TableColumn { key: string; label: string; kind: ColumnKind; lang?: 'th' | 'en' }`
  - `interface TableSchema { id: string; sectionId: string; title: string; columns: TableColumn[] }`
  - `type EditableRow = Record<string, string | string[]>`
  - `const TABLE_SCHEMAS: Record<string, TableSchema>` containing keys `'retention'` and `'addonLimits'`.

- [ ] **Step 1: Create `app/(public)/manual/tables.ts`**

```ts
export type ColumnKind = 'text' | 'lines'

export interface TableColumn {
  key: string
  label: string
  kind: ColumnKind
  /** omitted = shown on both language tabs; else only that tab */
  lang?: 'th' | 'en'
}

export interface TableSchema {
  id: string
  sectionId: string
  title: string
  columns: TableColumn[]
}

/** A row as handled by the editor: text cells are string, 'lines' cells are string[]. */
export type EditableRow = Record<string, string | string[]>

export const TABLE_SCHEMAS: Record<string, TableSchema> = {
  retention: {
    id: 'retention',
    sectionId: 'addon',
    title: 'ระยะเวลาเก็บสิ่งตัวอย่างหลังการตรวจวิเคราะห์',
    columns: [
      { key: 'emoji', label: 'ไอคอน', kind: 'text' },
      { key: 'sectionTh', label: 'งาน (ไทย)', kind: 'text', lang: 'th' },
      { key: 'sectionEn', label: 'Section (EN)', kind: 'text', lang: 'en' },
      { key: 'durationTh', label: 'ระยะเวลาเก็บ (แต่ละบรรทัด)', kind: 'lines' },
    ],
  },
  addonLimits: {
    id: 'addonLimits',
    sectionId: 'addon',
    title: 'ระยะเวลาของการเพิ่มรายการทดสอบโดยใช้ตัวอย่างเดิม',
    columns: [
      { key: 'emoji', label: 'ไอคอน', kind: 'text' },
      { key: 'sectionTh', label: 'งาน (ไทย)', kind: 'text', lang: 'th' },
      { key: 'sectionEn', label: 'Section (EN)', kind: 'text', lang: 'en' },
      { key: 'examplesTh', label: 'ตัวอย่าง (ไทย)', kind: 'text', lang: 'th' },
      { key: 'examplesEn', label: 'Examples (EN)', kind: 'text', lang: 'en' },
      { key: 'limitTh', label: 'ระยะเวลา (ไทย)', kind: 'text', lang: 'th' },
      { key: 'limitEn', label: 'Time limit (EN)', kind: 'text', lang: 'en' },
    ],
  },
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/manual/tables.ts"
git commit -m "feat(manual): define table schemas for retention and add-on tables"
```

---

## Task 4: Tables context + `useManualTable` hook

**Files:**
- Create: `app/(public)/manual/ManualTablesContext.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `type SectionTables = Record<string, unknown[]>` (tableId → rows)
  - `type DbTables = Record<string, SectionTables>` (sectionId → tables)
  - `<ManualTablesProvider value={{ tables, canEdit, setTableRows }}>` where `setTableRows(sectionId, tableId, rows)` updates local state after a save.
  - `useManualTable<T>(tableId: string, sectionId: string, defaultRows: T[]): { rows: T[]; canEdit: boolean; setRows: (rows: T[]) => void }`
    - `rows` = DB rows if present and non-empty, else `defaultRows`.
    - `setRows` updates context for this table (used by the editor after save).

- [ ] **Step 1: Create `app/(public)/manual/ManualTablesContext.tsx`**

```tsx
'use client'
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type SectionTables = Record<string, unknown[]>
export type DbTables = Record<string, SectionTables>

interface Ctx {
  tables: DbTables
  canEdit: boolean
  setTableRows: (sectionId: string, tableId: string, rows: unknown[]) => void
}

const ManualTablesCtx = createContext<Ctx>({ tables: {}, canEdit: false, setTableRows: () => {} })

export function ManualTablesProvider({
  initial, canEdit, children,
}: { initial: DbTables; canEdit: boolean; children: ReactNode }) {
  const [tables, setTables] = useState<DbTables>(initial)
  const setTableRows = useCallback((sectionId: string, tableId: string, rows: unknown[]) => {
    setTables(prev => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] ?? {}), [tableId]: rows },
    }))
  }, [])
  return (
    <ManualTablesCtx.Provider value={{ tables, canEdit, setTableRows }}>
      {children}
    </ManualTablesCtx.Provider>
  )
}

export function useManualTable<T>(tableId: string, sectionId: string, defaultRows: T[]) {
  const { tables, canEdit, setTableRows } = useContext(ManualTablesCtx)
  const dbRows = tables[sectionId]?.[tableId]
  const rows = (Array.isArray(dbRows) && dbRows.length > 0 ? (dbRows as T[]) : defaultRows)
  const setRows = useCallback((next: T[]) => setTableRows(sectionId, tableId, next as unknown[]), [sectionId, tableId, setTableRows])
  return { rows, canEdit, setRows }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/manual/ManualTablesContext.tsx"
git commit -m "feat(manual): add tables context and useManualTable hook"
```

---

## Task 5: API + page fetch + ManualShell provider wiring

**Files:**
- Modify: `app/api/admin/manual/[id]/route.ts`
- Modify: `app/(public)/manual/page.tsx`
- Modify: `app/(public)/manual/ManualShell.tsx:81-93` (Props + provider wrap)

**Interfaces:**
- Consumes: `DbTables`, `ManualTablesProvider` (Task 4); `sanitizeInlineHtml` (Task 2).
- Produces: PATCH accepts optional `table_data: Record<string, unknown[]>` and merges it into the section row; GET returns `table_data`; `ManualShell` accepts `dbTables?: DbTables` prop and provides it.

- [ ] **Step 1: Extend GET select in `route.ts`**

Change the GET select (currently `'id, body_html_th, body_html_en, updated_at'`) to include `table_data`:
```ts
    .select('id, body_html_th, body_html_en, table_data, updated_at')
```

- [ ] **Step 2: Extend PATCH in `route.ts`**

Replace the PATCH body-parse + upsert block so it merges `table_data`. Full new PATCH body (from after `const { id } = await params`):
```ts
  const body = await req.json()
  const { body_html_th, body_html_en, table_data } = body as {
    body_html_th?: string
    body_html_en?: string
    table_data?: Record<string, unknown[]>
  }

  // Load current row so we can merge table_data and not clobber sibling tables / other fields.
  const { data: current } = await supabaseAdmin
    .from('manual_sections')
    .select('body_html_th, body_html_en, table_data')
    .eq('id', id)
    .single()

  const nextTableData = table_data
    ? { ...(current?.table_data ?? {}), ...sanitizeTableData(table_data) }
    : (current?.table_data ?? null)

  const { data, error } = await supabaseAdmin
    .from('manual_sections')
    .upsert({
      id,
      body_html_th: sanitizeRichHtml(body_html_th ?? current?.body_html_th ?? ''),
      body_html_en: sanitizeRichHtml(body_html_en ?? current?.body_html_en ?? ''),
      table_data: nextTableData,
      updated_at: new Date().toISOString(),
      updated_by: actor.id,
    })
    .select('id, body_html_th, body_html_en, table_data, updated_at')
    .single()
```

- [ ] **Step 3: Add the `sanitizeTableData` helper + import in `route.ts`**

Update the import line:
```ts
import { sanitizeRichHtml, sanitizeInlineHtml } from '@/lib/html-sanitize'
```
Add above the GET handler:
```ts
// Sanitize any string values inside table rows (inline HTML only); arrays of strings are line cells.
function sanitizeCell(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeInlineHtml(value)
  if (Array.isArray(value)) return value.map(v => (typeof v === 'string' ? sanitizeInlineHtml(v) : ''))
  return ''
}
function sanitizeTableData(input: Record<string, unknown[]>): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {}
  for (const [tableId, rows] of Object.entries(input)) {
    if (!Array.isArray(rows)) continue
    out[tableId] = rows.map(row => {
      if (!row || typeof row !== 'object') return {}
      const clean: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(row as Record<string, unknown>)) clean[k] = sanitizeCell(v)
      return clean
    })
  }
  return out
}
```

Note: `sanitizeInlineHtml` is safe for plain text too (text with no tags passes through unchanged), so applying it to all string cells is fine.

- [ ] **Step 4: Type-check the route**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Extend `page.tsx` to fetch and pass `table_data`**

Change the select on line 14 to include `table_data`:
```ts
    supabase.from('manual_sections').select('id, body_html_th, body_html_en, table_data'),
```
After building `dbSections`, build `dbTables`:
```ts
  const dbTables: Record<string, Record<string, unknown[]>> = {}
  for (const row of sectionsData ?? []) {
    if (row.table_data && typeof row.table_data === 'object') {
      dbTables[row.id] = row.table_data as Record<string, unknown[]>
    }
  }
```
Change the render to pass it:
```tsx
  return <ManualShell dbSections={dbSections} dbTables={dbTables} canEdit={canEdit} />
```

- [ ] **Step 6: Wire the provider in `ManualShell.tsx`**

Add the import near the other manual imports:
```ts
import { ManualTablesProvider, type DbTables } from './ManualTablesContext'
```
Extend `Props` (currently lines 81-84):
```ts
interface Props {
  dbSections?: Record<string, { th: string; en: string }>
  dbTables?: DbTables
  canEdit?: boolean
}
```
Update the component signature:
```ts
export function ManualShell({ dbSections = {}, dbTables = {}, canEdit = false }: Props) {
```
Find the top-level returned JSX wrapper (the outermost `<>` opened at the `return (` on/around line 229) and wrap its children with the provider. Concretely, change `return (` + `<>` to:
```tsx
  return (
    <ManualTablesProvider initial={dbTables} canEdit={canEdit}>
    <>
```
and add `</ManualTablesProvider>` immediately after the matching closing `</>` at the end of the component's return.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 8: Verify in browser (no behavior change yet)**

Ensure the dev server is running (`npm run dev`). Load `/manual` → addon section. Expected: page renders exactly as before (tables still read from code defaults; provider is present but unused by components yet).

- [ ] **Step 9: Commit**

```bash
git add "app/api/admin/manual/[id]/route.ts" "app/(public)/manual/page.tsx" "app/(public)/manual/ManualShell.tsx"
git commit -m "feat(manual): plumb table_data through API, page, and shell provider"
```

---

## Task 6: Reusable inline table editor

**Files:**
- Create: `components/manual/ManualTableEditor.tsx`

**Interfaces:**
- Consumes: `TableSchema`, `TableColumn`, `EditableRow` (Task 3).
- Produces:
  - `<ManualTableEditor schema, rows, onSaved, onCancel />`
  - Props: `schema: TableSchema`, `rows: EditableRow[]`, `onSaved: (rows: EditableRow[]) => void`, `onCancel: () => void`.
  - Saves by PATCHing `/api/admin/manual/{schema.sectionId}` with `{ table_data: { [schema.id]: rows } }`, then calls `onSaved(savedRows)`; "reset to default" PATCHes `{ table_data: { [schema.id]: [] } }` and calls `onSaved([])`.

- [ ] **Step 1: Create `components/manual/ManualTableEditor.tsx`**

```tsx
'use client'
import { useState, useRef } from 'react'
import type { TableSchema, TableColumn, EditableRow } from '@/app/(public)/manual/tables'
import { sanitizeInlineHtml } from '@/lib/html-sanitize'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
  fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)',
  outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 3, display: 'block',
}
function btn(bg: string, fg: string, border = 'transparent'): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 8, border: `1px solid ${border}`, background: bg, color: fg,
    fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  }
}
function emptyRow(schema: TableSchema): EditableRow {
  const r: EditableRow = {}
  for (const c of schema.columns) r[c.key] = c.kind === 'lines' ? [''] : ''
  return r
}

/** Single-line contentEditable with a Bold button, stores sanitized inline HTML. */
function RichLine({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button type="button" title="ตัวหนา"
        onMouseDown={e => { e.preventDefault(); document.execCommand('bold') }}
        style={{ ...btn('var(--surface-2)', 'var(--ink)', 'var(--border)'), width: 30, fontWeight: 900 }}>B</button>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={() => onChange(sanitizeInlineHtml(ref.current?.innerHTML ?? ''))}
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ ...inputStyle, minHeight: 20 }} />
    </div>
  )
}

export function ManualTableEditor({
  schema, rows, onSaved, onCancel,
}: { schema: TableSchema; rows: EditableRow[]; onSaved: (rows: EditableRow[]) => void; onCancel: () => void }) {
  const hasLang = schema.columns.some(c => c.lang)
  const [editLang, setEditLang] = useState<'th' | 'en'>('th')
  const [draft, setDraft] = useState<EditableRow[]>(() => rows.length ? rows.map(r => ({ ...r })) : [emptyRow(schema)])
  const [saving, setSaving] = useState(false)

  const visibleCols = (c: TableColumn) => !c.lang || c.lang === editLang

  function setCell(i: number, key: string, value: string | string[]) {
    setDraft(d => d.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)))
  }
  function move(i: number, dir: -1 | 1) {
    setDraft(d => {
      const next = [...d]; const j = i + dir
      if (j < 0 || j >= next.length) return d
      ;[next[i], next[j]] = [next[j], next[i]]; return next
    })
  }

  async function persist(payloadRows: EditableRow[]) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/manual/${schema.sectionId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_data: { [schema.id]: payloadRows } }),
      })
      if (!res.ok) { alert((await res.json()).error ?? 'บันทึกไม่สำเร็จ'); return }
      const json = await res.json()
      onSaved((json.table_data?.[schema.id] as EditableRow[]) ?? payloadRows)
    } catch { alert('เกิดข้อผิดพลาด') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ border: '2px solid var(--primary)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'var(--primary)', color: '#fff', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>แก้ตาราง — {schema.title}</span>
        {hasLang && (['th', 'en'] as const).map(l => (
          <button key={l} onClick={() => setEditLang(l)}
            style={{ padding: '3px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
              background: editLang === l ? '#fff' : 'rgba(255,255,255,.2)', color: editLang === l ? 'var(--primary)' : '#fff' }}>
            {l === 'th' ? 'ภาษาไทย' : 'English'}
          </button>
        ))}
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--card)' }}>
        {draft.map((row, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', flex: 1 }}>แถวที่ {i + 1}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} style={btn('var(--surface-2)', 'var(--ink)', 'var(--border)')}>↑</button>
              <button onClick={() => move(i, 1)} disabled={i === draft.length - 1} style={btn('var(--surface-2)', 'var(--ink)', 'var(--border)')}>↓</button>
              <button onClick={() => setDraft(d => d.filter((_, idx) => idx !== i))} style={btn('transparent', 'var(--danger)', 'var(--danger)')}>ลบ</button>
            </div>
            {schema.columns.filter(visibleCols).map(col => (
              <div key={col.key}>
                <label style={labelStyle}>{col.label}</label>
                {col.kind === 'text' ? (
                  <input style={inputStyle} value={String(row[col.key] ?? '')}
                    onChange={e => setCell(i, col.key, e.target.value)} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {((row[col.key] as string[] | undefined) ?? ['']).map((line, li) => (
                      <div key={li} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <RichLine html={line} onChange={html => {
                            const arr = [...((row[col.key] as string[] | undefined) ?? [''])]; arr[li] = html; setCell(i, col.key, arr)
                          }} />
                        </div>
                        <button onClick={() => {
                          const arr = ((row[col.key] as string[] | undefined) ?? ['']).filter((_, x) => x !== li)
                          setCell(i, col.key, arr.length ? arr : [''])
                        }} style={btn('transparent', 'var(--danger)', 'var(--danger)')}>✕</button>
                      </div>
                    ))}
                    <button onClick={() => setCell(i, col.key, [...((row[col.key] as string[] | undefined) ?? ['']), ''])}
                      style={{ ...btn('var(--primary-soft)', 'var(--primary)'), alignSelf: 'flex-start' }}>＋ เพิ่มบรรทัด</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
        <button onClick={() => setDraft(d => [...d, emptyRow(schema)])}
          style={{ ...btn('var(--primary-soft)', 'var(--primary)'), alignSelf: 'flex-start' }}>＋ เพิ่มแถว</button>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flexWrap: 'wrap' }}>
        <button disabled={saving} onClick={() => persist(draft)} style={btn('var(--primary)', '#fff')}>บันทึก</button>
        <button disabled={saving} onClick={onCancel} style={btn('var(--card)', 'var(--ink)', 'var(--border)')}>ยกเลิก</button>
        <button disabled={saving}
          onClick={() => { if (confirm('ล้างข้อมูลที่แก้ และกลับไปใช้ค่าต้นฉบับ?')) persist([]) }}
          style={{ ...btn('transparent', 'var(--danger)', 'var(--danger)'), marginLeft: 'auto' }}>ล้าง → ใช้ค่าต้นฉบับ</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "components/manual/ManualTableEditor.tsx"
git commit -m "feat(manual): reusable inline table editor with bold + lang tabs"
```

---

## Task 7: Migrate the two addon tables to data-driven rendering

**Files:**
- Modify: `app/(public)/manual/sections/ManualAddon.tsx`

**Interfaces:**
- Consumes: `useManualTable` (Task 4), `ManualTableEditor` (Task 6), `TABLE_SCHEMAS` + `EditableRow` (Task 3).
- Produces: addon retention + addonLimits tables render from `useManualTable` (DB or code default), with an "แก้ตาราง" button (canEdit only) that swaps the table for the editor.

- [ ] **Step 1: Update imports at the top of `ManualAddon.tsx`**

Replace the current import block:
```ts
import { type CSSProperties, type ReactNode } from 'react'
import { H2, Section } from '../_primitives'
import { type Lang } from '../data'
```
with:
```ts
import { useState } from 'react'
import { H2, Section } from '../_primitives'
import { type Lang } from '../data'
import { useManualTable } from '../ManualTablesContext'
import { ManualTableEditor } from '@/components/manual/ManualTableEditor'
import { TABLE_SCHEMAS, type EditableRow } from '../tables'
```

- [ ] **Step 2: Reshape `RetentionItem.durationTh` to `string[]` and drop the now-unused `bold`/`CSSProperties`**

In the `RetentionItem` interface change `durationTh: ReactNode[]` to `durationTh: string[]`. Delete the line `const bold: CSSProperties = { fontWeight: 700, color: 'var(--ink)' }`. Replace the immunology row's `durationTh` (the only one using JSX) with inline-HTML strings, and leave the other rows' string arrays as-is:
```ts
    durationTh: [
      '7 วันทำการ 2–8°C',
      '<strong>Anti-HIV Positive</strong>: 15 วันทำการ',
      'ตัวอย่างส่งตรวจ <strong>Acid phosphatase for semen</strong> (ที่เหลือจากการตรวจวิเคราะห์) เก็บนาน 5 ปีที่อุณหภูมิห้อง',
      'สไลด์จากการย้อม <strong>Spermatozoa (คดี)</strong> เก็บนาน 10 ปี ที่อุณหภูมิห้อง',
    ], tempTh: '2–8°C',
```

- [ ] **Step 3: Read rows via the hook + track which table is being edited**

At the top of the `ManualAddon` component body (after `export function ManualAddon({ lang }: Props) {`), add:
```tsx
  const [editing, setEditing] = useState<string | null>(null)
  const addon = useManualTable<EditableRow>('addonLimits', 'addon', ADDON_LIMITS as unknown as EditableRow[])
  const retention = useManualTable<EditableRow>('retention', 'addon', RETENTION as unknown as EditableRow[])
```
Then in each table's JSX, iterate `addon.rows` / `retention.rows` instead of `ADDON_LIMITS` / `RETENTION`. Cast each row's fields when reading, e.g. `const a = row as unknown as AddonLimitItem` at the top of the map callback, and `const r = row as unknown as RetentionItem`. Keep the `key` unique by using the row index (`i`) since edited rows may share names: change `key={a.sectionTh}` → `key={i}` and `key={r.sectionTh}` → `key={i}`.

- [ ] **Step 4: Render bold in retention lines via `dangerouslySetInnerHTML` + scoped strong color**

Replace the retention duration cell render:
```tsx
                  <td style={{ padding: '10px 14px', borderRight: '1px solid var(--border)' }} className="retention-dur">
                    {r.durationTh.map((line, li) => (
                      <div key={li}>: <span dangerouslySetInnerHTML={{ __html: line }} /></div>
                    ))}
                  </td>
```
Wait — that cell is the FIRST column (has borderRight). The duration cell is the SECOND column. Apply the change to the SECOND `<td>` of the retention table (the one currently mapping `r.durationTh`), which has NO borderRight:
```tsx
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }} className="retention-dur">
                    {r.durationTh.map((line, li) => (
                      <div key={li}>: <span dangerouslySetInnerHTML={{ __html: line }} /></div>
                    ))}
                  </td>
```
Add a scoped style once, right after the retention `<Section>`'s opening `<h3>...</h3>` (so `<strong>` in these cells uses the ink color / bold, matching the previous look):
```tsx
        <style>{`.retention-dur strong { color: var(--ink); font-weight: 700; }`}</style>
```

- [ ] **Step 5: Add "แก้ตาราง" buttons and editor swap for each table**

For the addon-limits `<Section>`, between the `<h3>` and the table `<div>`, add:
```tsx
        {addon.canEdit && editing !== 'addonLimits' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button onClick={() => setEditing('addonLimits')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              แก้ตาราง
            </button>
          </div>
        )}
        {editing === 'addonLimits' ? (
          <ManualTableEditor schema={TABLE_SCHEMAS.addonLimits} rows={addon.rows}
            onSaved={rows => { addon.setRows(rows); setEditing(null) }}
            onCancel={() => setEditing(null)} />
        ) : (
          /* existing addon table <div> ... </div> stays here */
        )}
```
Apply the same pattern to the retention `<Section>` using `TABLE_SCHEMAS.retention`, `retention.rows`, `retention.setRows`, and the id `'retention'`. Wrap each existing table `<div style={{ border... }}>...</div>` as the `else` branch of its ternary.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. (If TS complains about unused `AddonLimitItem`/`RetentionItem`, they are still used as cast targets — keep them.)

- [ ] **Step 7: Verify appearance is unchanged (default path)**

With the dev server running, hard-refresh `/manual` → addon. Expected: both tables look **pixel-identical** to before — same emoji, column divider, multi-line durations, bold "Anti-HIV Positive"/"Acid phosphatase for semen"/"Spermatozoa (คดี)".

- [ ] **Step 8: Verify editing works (as Admin/Manager)**

Log in as Admin/Manager. On the retention table click "แก้ตาราง" → editor appears inline. Change a duration line, bold a word with **B**, add a row, reorder, click บันทึก. Expected: editor closes, table shows the edit. Hard-refresh: the edit persists. Click "แก้ตาราง" → "ล้าง → ใช้ค่าต้นฉบับ" → reverts to the code default.

- [ ] **Step 9: Verify non-editor sees read-only**

Open `/manual` logged out (or as a non-Admin/Manager). Expected: no "แก้ตาราง" button; tables render normally.

- [ ] **Step 10: Commit**

```bash
git add "app/(public)/manual/sections/ManualAddon.tsx"
git commit -m "feat(manual): make addon retention and time-limit tables editable"
```

---

## Task 8: Guard-rail banner for WYSIWYG override

**Files:**
- Modify: `app/(public)/manual/ManualShell.tsx` (view-mode block near line 586-604)

**Interfaces:**
- Consumes: existing `hasCustomContent`, `usesStaticComponent`, `canEdit`, `activeSection` in ManualShell.
- Produces: an info banner shown in view mode when the active section has a saved WYSIWYG override and the user can edit.

- [ ] **Step 1: Add the banner in the VIEW MODE branch**

In `ManualShell.tsx`, inside the `) : (` VIEW MODE branch (the `<>` that starts around line 586-587), immediately after the opening `<>`, add:
```tsx
              {canEdit && !usesStaticComponent && hasCustomContent && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', marginBottom: 12, background: 'rgba(217,119,6,.07)', border: '1px solid rgba(217,119,6,.3)', borderLeft: '3px solid #D97706', borderRadius: 9 }}>
                  <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1.4 }}>⚠️</span>
                  <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6 }}>
                    หน้านี้กำลังแสดง<strong>เนื้อหาที่แก้เอง</strong> — การอัปเดตจากระบบจะไม่ปรากฏจนกว่าจะกด “ล้าง → ใช้เนื้อหาต้นฉบับ” ในโหมดแก้ไข
                  </div>
                </div>
              )}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Verify**

As Admin/Manager, open a section that currently has a WYSIWYG override saved (or save one via "แก้ไขเนื้อหา" on e.g. the report section). Expected: the amber banner appears in view mode. On a section with no override, no banner.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/manual/ManualShell.tsx"
git commit -m "feat(manual): warn when a section is showing a WYSIWYG override"
```

---

## Self-Review Notes

- **Spec coverage:** storage (T1), inline sanitizer (T2), schemas (T3), read hook/context (T4), API+page+provider (T5), editor with inline+Bold+lang tabs (T6), migrate 2 addon tables + identical appearance (T7), guard-rail banner (T8). All spec sections covered. Later-iteration tables (phone/team/containers/critical/outlab) intentionally out of scope.
- **Types:** `EditableRow`, `TableSchema`, `TableColumn` defined in T3 and consumed unchanged in T4/T6/T7. `useManualTable<T>` signature `(tableId, sectionId, defaultRows)` consistent across T4 and T7. `DbTables` defined in T4, consumed in T5. `sanitizeInlineHtml` defined in T2, consumed in T5/T6.
- **No test runner:** verification uses `npx tsc --noEmit` + browser checks, matching repo reality (CLAUDE.md).
- **Appearance safety:** T7 Step 7 explicitly gates on pixel-identical rendering before accepting the migration.
