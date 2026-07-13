# Quality Task Meeting Participants + Sign-in PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let every quality-task template have a configurable default audience of expected participants (department and/or individual), overridable per occurrence, and let anyone viewing an occurrence download a pre-filled sign-in sheet PDF (matching the existing FM-QP-LAB-25-01 form) for physical signing.

**Architecture:** Two new nullable array-column pairs (`depts text[]`, `user_ids uuid[]`) — one on `quality_task_templates` as the default, one on `quality_task_instances` as a per-occurrence override — resolved with "non-empty override wins wholesale" logic identical to the existing `resolveAssigneeIds`. Resolution to actual people reuses `resolveReadAudience` from the documents module, with an "unconfigured = empty audience" guard at the call site (not "everyone", which is that function's own default). The PDF is a pure string-building function, rendered client-side via the existing HTML-blob → `window.open` → print pattern.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres), Zod, `node:assert/strict` scripts run via `npx tsx` (this codebase's existing test style — no test framework).

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-13-quality-task-meeting-participants-design.md` — read it before starting if anything below is ambiguous.
- Applies to every activity (`taskKind: 'activity'` and `'meeting'`), not just meetings.
- "Nothing configured" (both depts and user_ids empty) must resolve to an **empty** participant list — never "everyone". This is the opposite of `resolveReadAudience`'s own default, so the emptiness check happens at the call site, not inside that shared function.
- Override logic is "non-empty wins wholesale", not merged — mirrors `resolveAssigneeIds` in `lib/quality-tasks/logic.ts` exactly.
- No FK constraint on the new `uuid[]` columns (same trade-off `documents.read_audience_user_ids` already has).
- PDF: one static template (title/watermark/form-code/footer fixed, matching the attached FM-QP-LAB-25-01 sample exactly), 20 rows/page, only ลำดับที่/ชื่อ-สกุล/ตำแหน่ง auto-filled; ลายเซ็นต์/วันเดือนปี/หมายเหตุ and the หน่วยงาน/การประชุม/เรื่อง header lines stay blank. Must paginate correctly when the resolved audience exceeds 20 people (a real case, not hypothetical).
- Setting the template default and overriding per occurrence both require `level === 'edit'` (same gate as editing assignees today). Downloading the PDF has no extra gate beyond viewing the occurrence.
- `npx tsc --noEmit` must pass after every task that touches TypeScript.

---

### Task 1: Schema migration

**Files:**
- Create: `scripts/quality-task-participants.sql`

**Interfaces:**
- Produces: `quality_task_templates.default_participant_depts` (`text[]`), `quality_task_templates.default_participant_user_ids` (`uuid[]`), `quality_task_instances.participant_depts` (`text[]`), `quality_task_instances.participant_user_ids` (`uuid[]`).

- [ ] **Step 1: Write the migration script**

```sql
-- Quality Task meeting participants. Run in Supabase Dashboard -> SQL Editor.
-- Idempotent: uses IF NOT EXISTS.

alter table public.quality_task_templates
  add column if not exists default_participant_depts text[],
  add column if not exists default_participant_user_ids uuid[];

alter table public.quality_task_instances
  add column if not exists participant_depts text[],
  add column if not exists participant_user_ids uuid[];
```

- [ ] **Step 2: Commit**

```bash
git add scripts/quality-task-participants.sql
git commit -m "feat: add meeting-participant columns to quality task templates and instances"
```

This script is not run automatically (project convention — see CLAUDE.md "Database Migrations"). It must be run manually in Supabase Dashboard → SQL Editor before Task 4's server code will work against a real database.

---

### Task 2: Participant resolution logic

**Files:**
- Create: `lib/quality-tasks/participants.ts`
- Create: `lib/quality-tasks/participants.test.ts`

**Interfaces:**
- Consumes: `resolveReadAudience` from `lib/documents/read-audience.ts` — signature `resolveReadAudience<T extends {id:string; dept:string|null}>(people: T[], depts: readonly string[] | null | undefined, userIds: readonly string[] | null | undefined): T[]`.
- Produces: `resolveParticipantSelection(defaultDepts: string[], defaultUserIds: string[], overrideDepts: string[], overrideUserIds: string[]): { depts: string[]; userIds: string[] }` and `resolveParticipants<T extends {id:string; dept:string|null}>(people: T[], depts: string[], userIds: string[]): T[]`.

- [ ] **Step 1: Write the failing test**

Create `lib/quality-tasks/participants.test.ts`:

```ts
import assert from 'node:assert/strict'
import { resolveParticipantSelection, resolveParticipants } from './participants'

// resolveParticipantSelection: non-empty override wins wholesale, same rule as resolveAssigneeIds
assert.deepEqual(
  resolveParticipantSelection(['A'], ['u1'], [], []),
  { depts: ['A'], userIds: ['u1'] },
  'no override configured -> falls back to the template default',
)
assert.deepEqual(
  resolveParticipantSelection(['A'], ['u1'], ['B'], []),
  { depts: ['B'], userIds: [] },
  'a non-empty override replaces the default wholesale, not merged',
)
assert.deepEqual(
  resolveParticipantSelection(['A'], ['u1'], [], ['u2']),
  { depts: [], userIds: ['u2'] },
  'an override with only user_ids still fully replaces the dept default',
)

// resolveParticipants: unconfigured must resolve to EMPTY, not everyone
type P = { id: string; dept: string | null }
const people: P[] = [
  { id: 'u1', dept: 'A' },
  { id: 'u2', dept: 'B' },
  { id: 'u3', dept: null },
]
assert.deepEqual(resolveParticipants(people, [], []), [], 'unconfigured selection resolves to an empty audience')
assert.deepEqual(resolveParticipants(people, ['A'], []).map(p => p.id), ['u1'], 'resolves department members')
assert.deepEqual(resolveParticipants(people, [], ['u3']).map(p => p.id), ['u3'], 'resolves an individually-selected person with no dept')
assert.deepEqual(resolveParticipants(people, ['A'], ['u3']).map(p => p.id).sort(), ['u1', 'u3'], 'union of dept and individual selection')

console.log('lib/quality-tasks/participants.test.ts: all assertions passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx lib/quality-tasks/participants.test.ts`
Expected: fails to resolve `./participants` (module does not exist yet).

- [ ] **Step 3: Implement**

Create `lib/quality-tasks/participants.ts`:

```ts
import { resolveReadAudience } from '@/lib/documents/read-audience'

// Mirrors resolveAssigneeIds in ./logic.ts: a non-empty override replaces the
// default wholesale (not merged); an empty override means "no override, use default".
export function resolveParticipantSelection(
  defaultDepts: string[], defaultUserIds: string[],
  overrideDepts: string[], overrideUserIds: string[],
): { depts: string[]; userIds: string[] } {
  const useOverride = overrideDepts.length > 0 || overrideUserIds.length > 0
  return useOverride
    ? { depts: overrideDepts, userIds: overrideUserIds }
    : { depts: defaultDepts, userIds: defaultUserIds }
}

// Unlike resolveReadAudience's own default ("nothing selected" = everyone), an
// unconfigured meeting-participant selection must resolve to an EMPTY list —
// an unconfigured template should not silently invite the entire staff roster.
export function resolveParticipants<T extends { id: string; dept: string | null }>(
  people: T[], depts: string[], userIds: string[],
): T[] {
  if (depts.length === 0 && userIds.length === 0) return []
  return resolveReadAudience(people, depts, userIds)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx lib/quality-tasks/participants.test.ts`
Expected: `lib/quality-tasks/participants.test.ts: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add lib/quality-tasks/participants.ts lib/quality-tasks/participants.test.ts
git commit -m "feat: add meeting-participant resolution logic"
```

---

### Task 3: Sign-in sheet PDF builder

**Files:**
- Create: `lib/quality-tasks/participant-sign-in-pdf.ts`
- Create: `lib/quality-tasks/participant-sign-in-pdf.test.ts`

**Interfaces:**
- Produces: `export interface SignInParticipant { name: string; documentPosition: string | null }` and `export function buildParticipantSignInHtml(participants: SignInParticipant[]): string`.

- [ ] **Step 1: Write the failing test**

Create `lib/quality-tasks/participant-sign-in-pdf.test.ts`:

```ts
import assert from 'node:assert/strict'
import { buildParticipantSignInHtml } from './participant-sign-in-pdf'

function countOccurrences(haystack: string, needle: string) {
  return haystack.split(needle).length - 1
}

// Every body row's first cell is `<td class="c">` (row number) — header cells use <th>,
// so this marker counts exactly the data rows, independent of the header row's own <tr>.
function countBodyRows(html: string) {
  return countOccurrences(html, '<td class="c">')
}

// 5 participants -> one page, 20 total rows (5 filled + 15 blank)
const small = buildParticipantSignInHtml([
  { name: 'สมชาย ใจดี', documentPosition: 'นักเทคนิคการแพทย์ปฏิบัติการ' },
  { name: 'สมหญิง ขยัน', documentPosition: 'นักเทคนิคการแพทย์ชำนาญการ' },
  { name: 'A', documentPosition: null },
  { name: 'B', documentPosition: null },
  { name: 'C', documentPosition: null },
])
assert.equal(countOccurrences(small, 'class="qt-sign-page"'), 1, 'small list fits on one page')
assert.equal(countBodyRows(small), 20, 'one page always has exactly 20 data rows')
assert.ok(small.includes('สมชาย ใจดี'), 'participant name is rendered')
assert.ok(small.includes('นักเทคนิคการแพทย์ปฏิบัติการ'), 'document position is rendered')
assert.ok(small.includes('Fm-QP-LAB-25/01'), 'form code footer is present')
assert.ok(small.includes('แบบบันทึกใบลงนามรับทราบการสื่อสารเพื่อการพัฒนา'), 'form title is present')

// 25 participants -> two pages; page 1 fully filled (no blank name cells), page 2 has 5 filled + 15 blank
const many = buildParticipantSignInHtml(
  Array.from({ length: 25 }, (_, i) => ({ name: `Person ${i + 1}`, documentPosition: null })),
)
assert.equal(countOccurrences(many, 'class="qt-sign-page"'), 2, 'more than 20 participants paginates to a second page')
assert.equal(countBodyRows(many), 40, 'two pages always have 40 data rows total (20 each)')
assert.ok(many.includes('Person 1') && many.includes('Person 20') && many.includes('Person 21') && many.includes('Person 25'))

// 0 participants -> still renders one usable blank page
const empty = buildParticipantSignInHtml([])
assert.equal(countOccurrences(empty, 'class="qt-sign-page"'), 1)
assert.equal(countBodyRows(empty), 20)

// Names must be HTML-escaped (defense in depth against a stray "<"/"&" in a profile name)
const escaped = buildParticipantSignInHtml([{ name: '<script>alert(1)</script>', documentPosition: null }])
assert.ok(!escaped.includes('<script>alert(1)</script>'), 'raw script tag must not appear unescaped')
assert.ok(escaped.includes('&lt;script&gt;'), 'name is HTML-escaped')

console.log('lib/quality-tasks/participant-sign-in-pdf.test.ts: all assertions passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx lib/quality-tasks/participant-sign-in-pdf.test.ts`
Expected: fails to resolve `./participant-sign-in-pdf` (module does not exist yet).

- [ ] **Step 3: Implement**

Create `lib/quality-tasks/participant-sign-in-pdf.ts`:

```ts
export interface SignInParticipant {
  name: string
  documentPosition: string | null
}

const ROWS_PER_PAGE = 20

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildPage(participants: SignInParticipant[], pageIndex: number, isLastPage: boolean): string {
  const start = pageIndex * ROWS_PER_PAGE
  const rows = Array.from({ length: ROWS_PER_PAGE }, (_, i) => {
    const rowNo = start + i
    const person = participants[rowNo]
    const name = person ? escapeHtml(person.name) : ''
    const position = person?.documentPosition ? escapeHtml(person.documentPosition) : ''
    return `<tr><td class="c">${rowNo + 1}</td><td class="l">${name}</td><td class="l">${position}</td><td></td><td></td><td></td></tr>`
  }).join('')

  return `<div class="qt-sign-page">
    <div class="qt-sign-title">แบบบันทึกใบลงนามรับทราบการสื่อสารเพื่อการพัฒนา</div>
    <div class="qt-sign-line">หน่วยงาน .............................................. กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี</div>
    <div class="qt-sign-line">การประชุม .................................................................. เรื่อง ............................................</div>
    <table>
      <thead><tr><th>ลำดับที่</th><th>ชื่อ - สกุล</th><th>ตำแหน่ง</th><th>ลายเซ็นต์</th><th>วัน เดือน ปี</th><th>หมายเหตุ</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="qt-sign-watermark">
      <span>กลุ่มงานเทคนิคการแพทย์</span>
      <span>โรงพยาบาลชลบุรี</span>
    </div>
    <div class="qt-sign-footer">
      <span class="qt-sign-footer-notice">เอกสารนี้เป็นสมบัติของกลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี ห้ามนำออกไปใช้ภายนอกหรือทำซ้ำโดยไม่ได้รับอนุญาต</span>
      <span class="qt-sign-footer-code">Fm-QP-LAB-25/01</span>
    </div>
  </div>${isLastPage ? '' : ''}`
}

// Renders the FM-QP-LAB-25-01 sign-in sheet as a print-ready HTML document.
// Only ลำดับที่/ชื่อ-สกุล/ตำแหน่ง are auto-filled; ลายเซ็นต์/วันเดือนปี/หมายเหตุ and the
// หน่วยงาน/การประชุม/เรื่อง header lines stay blank for manual fill-in at print time.
// Pages are fixed at 20 rows each — a resolved audience can realistically exceed 20
// (e.g. an all-departments meeting), so every page repeats the header/watermark/footer
// and only the LAST page pads with blank rows.
export function buildParticipantSignInHtml(participants: SignInParticipant[]): string {
  const pageCount = Math.max(1, Math.ceil(participants.length / ROWS_PER_PAGE))
  const pagesHtml = Array.from({ length: pageCount }, (_, pageIndex) =>
    buildPage(participants, pageIndex, pageIndex === pageCount - 1),
  ).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ใบลงนามรับทราบการสื่อสาร</title><style>
    @page { size: A4 portrait; margin: 12mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'TH Sarabun New','Sarabun','Cordia New',Arial,sans-serif; font-size: 14pt; color: #000; }
    .qt-sign-page { page-break-after: always; position: relative; display: flex; flex-direction: column; height: 273mm; }
    .qt-sign-page:last-child { page-break-after: avoid; }
    .qt-sign-title { text-align: center; font-size: 18pt; font-weight: bold; margin-bottom: 10px; }
    .qt-sign-line { text-align: center; font-size: 14pt; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #000; padding: 4px 6px; font-size: 12pt; height: 26px; }
    th { background: #f0f0f0; font-weight: bold; text-align: center; }
    .c { text-align: center; }
    .l { text-align: left; }
    .qt-sign-watermark { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; pointer-events: none; z-index: -1; opacity: .12; transform: rotate(-30deg); font-size: 30pt; font-weight: bold; }
    .qt-sign-footer { display: flex; align-items: center; margin-top: auto; padding-top: 6px; font-size: 10pt; color: #333; }
    .qt-sign-footer-notice { flex: 1; text-align: center; }
    .qt-sign-footer-code { white-space: nowrap; }
  </style></head><body>${pagesHtml}</body></html>`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx lib/quality-tasks/participant-sign-in-pdf.test.ts`
Expected: `lib/quality-tasks/participant-sign-in-pdf.test.ts: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add lib/quality-tasks/participant-sign-in-pdf.ts lib/quality-tasks/participant-sign-in-pdf.test.ts
git commit -m "feat: add meeting sign-in sheet PDF builder"
```

---

### Task 4: Types + server logic + API validation

**Files:**
- Modify: `lib/quality-tasks/types.ts`
- Modify: `lib/quality-tasks/server.ts`
- Modify: `app/api/admin/quality-tasks/templates/route.ts`
- Modify: `app/api/admin/quality-tasks/occurrences/[id]/route.ts`

**Interfaces:**
- Consumes: `resolveParticipantSelection`, `resolveParticipants` from Task 2.
- Produces: `QualityTaskTemplate.defaultParticipantDepts: string[]`, `.defaultParticipantUserIds: string[]`; `QualityTaskOccurrence.participantDepts: string[]`, `.participantUserIds: string[]`, `.participants: { id: string; name: string; documentPosition: string | null }[]`.

- [ ] **Step 1: Extend types**

In `lib/quality-tasks/types.ts`, update `QualityTaskTemplate`:

```ts
export interface QualityTaskTemplate {
  id: string
  sourceKey: string | null
  categoryCode: string
  categoryName: string
  activityNo: number | null
  title: string
  description: string | null
  referenceCode: string | null
  frequencyText: string
  ownerText: string
  taskKind: TaskKind
  reminderDays: number
  evidenceRequired: boolean
  active: boolean
  defaultAssigneeIds: string[]
  defaultParticipantDepts: string[]
  defaultParticipantUserIds: string[]
  schedules: QualityTaskSchedule[]
}
```

Update `QualityTaskOccurrence`:

```ts
export interface QualityTaskOccurrence {
  key: string
  instanceId: string | null
  template: QualityTaskTemplate
  scheduleId: string | null
  periodStart: string
  periodEnd: string
  periodLabel: string
  plannedDate: string | null
  status: TaskStatus
  note: string | null
  completionNote: string | null
  completedBy: string | null
  completedAt: string | null
  assigneeIds: string[]
  participantDepts: string[]
  participantUserIds: string[]
  participants: { id: string; name: string; documentPosition: string | null }[]
  attachments: QualityTaskAttachment[]
  scheduling: TaskSchedulingState
  urgency: TaskUrgency
  effectiveDueDate: string
}
```

Update `OccurrenceActionPayload`'s `'schedule'` variant:

```ts
export type OccurrenceActionPayload =
  | { action: 'schedule'; plannedDate: string | null; note?: string | null; assigneeIds?: string[]; participantDepts?: string[]; participantUserIds?: string[] }
  | { action: 'complete'; completionNote?: string | null }
  | { action: 'reopen'; reason: string }
```

- [ ] **Step 2: Wire resolution into `lib/quality-tasks/server.ts`**

Add the import:

```ts
import { resolveParticipantSelection, resolveParticipants } from './participants'
```

In `getQualityTaskTemplates`, extend the mapped return object (the `select('*')` already returns the new columns — only the mapping needs updating):

```ts
    active: Boolean(row.active), defaultAssigneeIds: defaults.get(str(row.id)) ?? [],
    defaultParticipantDepts: (row.default_participant_depts ?? []) as string[],
    defaultParticipantUserIds: (row.default_participant_user_ids ?? []) as string[],
    schedules: schedules.get(str(row.id)) ?? [],
```

In `getQualityTaskOccurrences`, fetch people once at the top (after `templates`) and compute participants for both the scheduled-occurrence loop and the ad-hoc loop:

```ts
export async function getQualityTaskOccurrences(input: { from: string; to: string; actorId: string; level: PermLevel; scope?: 'mine' | 'all' }) {
  const templates = await getQualityTaskTemplates(true)
  const people = await listTaskPeople()
  const { data: instanceRows, error } = await supabaseAdmin.from('quality_task_instances').select('*').lte('period_start', input.to).gte('period_end', input.from)
  fail(error)
```

(`listTaskPeople` is declared later in the same file — hoisting is fine since it's a top-level `export async function`.)

Then, inside the scheduled-occurrence loop, right after the existing `const assigned = resolveAssigneeIds(...)` line, add:

```ts
        const rowDepts = row ? ((row.participant_depts ?? []) as string[]) : []
        const rowUserIds = row ? ((row.participant_user_ids ?? []) as string[]) : []
        const selection = resolveParticipantSelection(template.defaultParticipantDepts, template.defaultParticipantUserIds, rowDepts, rowUserIds)
        const resolvedParticipants = resolveParticipants(people, selection.depts, selection.userIds)
```

And extend the pushed object to include:

```ts
          assigneeIds: assigned, participantDepts: rowDepts, participantUserIds: rowUserIds,
          participants: resolvedParticipants.map(p => ({ id: str(p.id), name: str(p.name), documentPosition: nullable((p as Row).document_position) })),
```

Do the same in the ad-hoc-instance loop (the second `for (const row of (instanceRows ?? []) as Row[])` block): add the same `rowDepts`/`rowUserIds`/`selection`/`resolvedParticipants` computation right after its `const assigned = resolveAssigneeIds(...)` line, and add the same three fields (`participantDepts`, `participantUserIds`, `participants`) to its pushed object.

In `updateOccurrence`, extend the `'schedule'` branch:

```ts
  if (payload.action === 'schedule') {
    if ((payload.assigneeIds || payload.participantDepts || payload.participantUserIds) && level !== 'edit') throw new Error('Forbidden')
    const { error } = await supabaseAdmin.from('quality_task_instances').update({
      planned_date: payload.plannedDate || null, note: payload.note?.trim() || null,
      updated_by: actor.id, updated_at: new Date().toISOString(),
      ...(payload.participantDepts ? { participant_depts: payload.participantDepts } : {}),
      ...(payload.participantUserIds ? { participant_user_ids: payload.participantUserIds } : {}),
    }).eq('id', instanceId)
    fail(error); if (payload.assigneeIds) await replaceAssignees(instanceId, payload.assigneeIds)
  } else if (payload.action === 'complete') {
```

In `saveTemplate`, extend the `payload` object built at the top of the function:

```ts
  const payload = { category_code: input.categoryCode, category_name: input.categoryName, activity_no: input.activityNo, title: input.title.trim(), description: input.description?.trim() || null, reference_code: input.referenceCode?.trim() || null, frequency_text: input.frequencyText.trim(), owner_text: input.ownerText.trim(), task_kind: input.taskKind, reminder_days: input.reminderDays, evidence_required: input.evidenceRequired, active: input.active, default_participant_depts: input.defaultParticipantDepts, default_participant_user_ids: input.defaultParticipantUserIds, updated_at: new Date().toISOString() }
```

In `listTaskPeople`, add the new column to the select:

```ts
export async function listTaskPeople() {
  const { data, error } = await supabaseAdmin.from('profiles').select('id,name,dept,role,document_position').is('deleted_at', null).order('name')
  fail(error); return data ?? []
}
```

- [ ] **Step 3: Extend Zod validation**

In `app/api/admin/quality-tasks/templates/route.ts`, add the import and extend `templateSchema`:

```ts
import { DEPARTMENTS } from '@/lib/validations/user-schema'

export const templateSchema = z.object({ categoryCode: z.string().regex(/^[A-I]$/), categoryName: z.string().trim().min(1), activityNo: z.number().int().positive().nullable(), title: z.string().trim().min(1), description: z.string().nullable(), referenceCode: z.string().nullable(), frequencyText: z.string().trim().min(1), ownerText: z.string(), taskKind: z.enum(['activity','meeting']), reminderDays: z.number().int().min(0).max(365), evidenceRequired: z.boolean(), active: z.boolean(), defaultAssigneeIds: z.array(z.string().uuid()), defaultParticipantDepts: z.array(z.enum(DEPARTMENTS)).default([]), defaultParticipantUserIds: z.array(z.string().uuid()).default([]), schedules: z.array(scheduleSchema) })
```

In `app/api/admin/quality-tasks/occurrences/[id]/route.ts`, add the import and extend the `'schedule'` branch of `actionSchema`:

```ts
import { DEPARTMENTS } from '@/lib/validations/user-schema'

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('schedule'), plannedDate: z.string().date().nullable(), note: z.string().max(2000).nullable().optional(), assigneeIds: z.array(z.string().uuid()).optional(), participantDepts: z.array(z.enum(DEPARTMENTS)).optional(), participantUserIds: z.array(z.string().uuid()).optional() }),
  z.object({ action: z.literal('complete'), completionNote: z.string().max(2000).nullable().optional() }),
  z.object({ action: z.literal('reopen'), reason: z.string().trim().min(1).max(500) }),
])
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (Two call sites will now fail to compile until Task 5/6 update them — see next step.)

If step 4 reports errors in `app/(protected)/staff/quality-tasks/page.tsx`, `app/(protected)/staff/quality-tasks/registry/page.tsx`, `components/quality-tasks/QualityTaskDashboard.tsx`, or `components/quality-tasks/QualityTaskRegistry.tsx` about missing `defaultParticipantDepts`/`defaultParticipantUserIds`/`participants` fields, that is expected — those are fixed in Tasks 5 and 6. Confirm the errors are confined to those four files before proceeding.

- [ ] **Step 5: Commit**

```bash
git add lib/quality-tasks/types.ts lib/quality-tasks/server.ts app/api/admin/quality-tasks/templates/route.ts "app/api/admin/quality-tasks/occurrences/[id]/route.ts"
git commit -m "feat: resolve and persist meeting participants server-side"
```

---

### Task 5: Registry — template default participant picker

**Files:**
- Modify: `app/(protected)/staff/quality-tasks/registry/page.tsx`
- Modify: `components/quality-tasks/QualityTaskRegistry.tsx`

**Interfaces:**
- Consumes: `QualityTaskTemplate.defaultParticipantDepts`/`defaultParticipantUserIds` (Task 4), `DEPARTMENTS` from `@/lib/validations/user-schema`.

- [ ] **Step 1: Pass `document_position` through the registry page**

In `app/(protected)/staff/quality-tasks/registry/page.tsx`, update the people cast:

```ts
return <QualityTaskRegistry level={level} initialTemplates={templates} people={people as {id:string;name:string;dept:string|null;role:string;document_position:string|null}[]}/>
```

- [ ] **Step 2: Update `blank()` and the `Person` type in `QualityTaskRegistry.tsx`**

```ts
type Person={id:string;name:string;dept:string|null;role:string;document_position:string|null}
```

```ts
function blank(no:number):QualityTaskTemplate{return{id:'',sourceKey:null,categoryCode:'A',categoryName:CATS.A,activityNo:no,title:'',description:null,referenceCode:null,frequencyText:'ตามที่กำหนด',ownerText:'',taskKind:'activity',reminderDays:7,evidenceRequired:false,active:true,defaultAssigneeIds:[],defaultParticipantDepts:[],defaultParticipantUserIds:[],schedules:[]}}
```

- [ ] **Step 3: Add the `DEPARTMENTS` import and a compact picker component**

Add near the top of the file:

```ts
import { DEPARTMENTS } from '@/lib/validations/user-schema'
```

Add this component alongside `Badge`/`Field` at the bottom of the file:

```tsx
function ParticipantPicker({depts,userIds,onChange,people}:{depts:string[];userIds:string[];onChange:(depts:string[],userIds:string[])=>void;people:Person[]}){
  function toggleDept(d:string){onChange(depts.includes(d)?depts.filter(x=>x!==d):[...depts,d],userIds)}
  return <div style={{display:'grid',gap:8}}>
    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>{DEPARTMENTS.map(d=><label key={d} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 9px',borderRadius:20,border:`1px solid ${depts.includes(d)?'var(--primary)':'var(--border)'}`,background:depts.includes(d)?'var(--primary-soft)':'transparent',fontSize:11.5,cursor:'pointer'}}><input type="checkbox" checked={depts.includes(d)} onChange={()=>toggleDept(d)} style={{accentColor:'var(--primary)'}}/>{d}</label>)}</div>
    <select multiple value={userIds} onChange={e=>onChange(depts,Array.from(e.target.selectedOptions).map(o=>o.value))} style={{...inputStyle,height:90}}>{people.map(p=><option key={p.id} value={p.id}>{p.name} · {p.dept??p.role}</option>)}</select>
  </div>
}
```

- [ ] **Step 4: Add the field to the edit form**

In the template edit modal's field grid (the `<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',...}}>` block), add a new `Field` entry right after the `"ผู้รับผิดชอบเริ่มต้น"` field:

```tsx
<Field label="ผู้เข้าร่วมประชุม (ค่าเริ่มต้น)" wide><ParticipantPicker depts={draft.defaultParticipantDepts} userIds={draft.defaultParticipantUserIds} onChange={(depts,userIds)=>setDraft(d=>d?{...d,defaultParticipantDepts:depts,defaultParticipantUserIds:userIds}:d)} people={people}/></Field>
```

- [ ] **Step 5: Type-check and manually verify**

Run: `npx tsc --noEmit`
Expected: no errors remaining in `QualityTaskRegistry.tsx` or its page (errors in `QualityTaskDashboard.tsx` and its page are still expected until Task 6).

Manual check (requires `npm run dev` and a browser): open `/staff/quality-tasks/registry` as an edit-level user, open "แก้ไข" on any activity, confirm the "ผู้เข้าร่วมประชุม (ค่าเริ่มต้น)" section renders department chips + a person multi-select, toggling a department chip highlights it, saving persists (re-open the same activity and confirm the selection survived).

- [ ] **Step 6: Commit**

```bash
git add "app/(protected)/staff/quality-tasks/registry/page.tsx" components/quality-tasks/QualityTaskRegistry.tsx
git commit -m "feat: add default meeting-participant picker to the activity registry"
```

---

### Task 6: Dashboard — occurrence participants, override, and PDF download

**Files:**
- Modify: `app/(protected)/staff/quality-tasks/page.tsx`
- Modify: `components/quality-tasks/QualityTaskDashboard.tsx`

**Interfaces:**
- Consumes: `QualityTaskOccurrence.participants`/`participantDepts`/`participantUserIds` (Task 4), `buildParticipantSignInHtml` (Task 3), `DEPARTMENTS` from `@/lib/validations/user-schema`.

- [ ] **Step 1: Pass `document_position` through the dashboard page**

In `app/(protected)/staff/quality-tasks/page.tsx`, update the people cast:

```ts
return <QualityTaskDashboard actorId={actor.id} level={level} initialMonth={`${year}-${String(month + 1).padStart(2, '0')}`} initialOccurrences={occurrences} templates={templates} people={people as { id: string; name: string; dept: string | null; role: string; document_position: string | null }[]} />
```

- [ ] **Step 2: Update the `Person` type and imports in `QualityTaskDashboard.tsx`**

```ts
type Person = { id: string; name: string; dept: string | null; role: string; document_position: string | null }
```

Add imports:

```ts
import { DEPARTMENTS } from '@/lib/validations/user-schema'
import { buildParticipantSignInHtml } from '@/lib/quality-tasks/participant-sign-in-pdf'
```

- [ ] **Step 3: Add the `ParticipantPicker` component**

Same component as Task 5 (this module deliberately keeps two local copies rather than sharing one — see the design spec's "Out of scope" section). Add near `Status`/`Info` at the bottom of the file:

```tsx
function ParticipantPicker({depts,userIds,onChange,people}:{depts:string[];userIds:string[];onChange:(depts:string[],userIds:string[])=>void;people:Person[]}){
  function toggleDept(d:string){onChange(depts.includes(d)?depts.filter(x=>x!==d):[...depts,d],userIds)}
  return <div style={{display:'grid',gap:8}}>
    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>{DEPARTMENTS.map(d=><label key={d} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 9px',borderRadius:20,border:`1px solid ${depts.includes(d)?'var(--primary)':'var(--border)'}`,background:depts.includes(d)?'var(--primary-soft)':'transparent',fontSize:11.5,cursor:'pointer'}}><input type="checkbox" checked={depts.includes(d)} onChange={()=>toggleDept(d)} style={{accentColor:'var(--primary)'}}/>{d}</label>)}</div>
    <select multiple value={userIds} onChange={e=>onChange(depts,Array.from(e.target.selectedOptions).map(o=>o.value))} style={{...inputStyle,height:90}}>{people.map(p=><option key={p.id} value={p.id}>{p.name} · {p.dept??p.role}</option>)}</select>
  </div>
}
```

- [ ] **Step 4: Add the download handler**

Add this function alongside `removeAttachment`/`createAdHoc`:

```ts
function downloadSignInSheet(){
  if(!selected||selected.participants.length===0)return
  const html=buildParticipantSignInHtml(selected.participants.map(p=>({name:p.name,documentPosition:p.documentPosition})))
  const blobUrl=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}))
  const win=window.open(blobUrl,'_blank')
  if(!win){URL.revokeObjectURL(blobUrl);return}
  win.addEventListener('load',()=>{win.print();URL.revokeObjectURL(blobUrl)},{once:true})
}
```

- [ ] **Step 5: Render participants info, override picker, and download button in the occurrence detail modal**

In the `selected` detail panel, right after the existing `<Info label="ผู้รับผิดชอบ" .../>` element inside the `<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',...}}>` grid, add:

```tsx
<Info label="ผู้เข้าร่วมประชุม" value={selected.participants.map(p=>p.name).join(', ')||'ยังไม่กำหนด'}/>
```

Right after that grid's closing `</div>`, add the download button (visible whenever the resolved list is non-empty, no extra permission gate):

```tsx
{selected.participants.length>0&&<div style={{marginTop:10}}><Button variant="secondary" size="sm" icon="download" onClick={downloadSignInSheet}>ดาวน์โหลด PDF ใบลงนาม ({selected.participants.length} คน)</Button></div>}
```

Inside the existing `{canAct&&<div ...>}` block (the same block containing "ผู้รับผิดชอบงวดนี้"), right after that `{level==='edit'&&<label ...ผู้รับผิดชอบงวดนี้.../>}` element, add the override picker (same `level==='edit'` gate, writes through the existing `mutate(..., {action:'schedule', ...})` path):

```tsx
{level==='edit'&&<label style={labelStyle}>ผู้เข้าร่วมประชุม (เฉพาะงวดนี้)<ParticipantPicker depts={selected.participantDepts} userIds={selected.participantUserIds} onChange={(depts,userIds)=>mutate(selected,{action:'schedule',plannedDate:selected.plannedDate,participantDepts:depts,participantUserIds:userIds})} people={people}/></label>}
```

- [ ] **Step 6: Type-check and manually verify**

Run: `npx tsc --noEmit`
Expected: no errors anywhere.

Manual check (requires `npm run dev` and a browser):
1. Open `/staff/quality-tasks`, click an occurrence whose template has a default participant audience configured (from Task 5) → confirm "ผู้เข้าร่วมประชุม" shows the resolved names and the download button appears with the correct count.
2. Click "ดาวน์โหลด PDF ใบลงนาม" → confirm a new tab opens the print dialog with a form matching the FM-QP-LAB-25-01 layout, names/positions filled in order, blank rows below, watermark and footer visible.
3. As an edit-level user, use the "ผู้เข้าร่วมประชุม (เฉพาะงวดนี้)" picker to override just this occurrence → confirm only this occurrence's participants change; reload the month and confirm other occurrences of the same template still show the template default.
4. Configure a template default covering every department (or pick a template that already resolves to a large group) → confirm the downloaded PDF has multiple `.qt-sign-page` blocks (multiple physical pages when printed), each repeating the header/watermark/footer, and only the last page has blank trailing rows.

- [ ] **Step 7: Commit**

```bash
git add "app/(protected)/staff/quality-tasks/page.tsx" components/quality-tasks/QualityTaskDashboard.tsx
git commit -m "feat: show meeting participants, allow per-occurrence override, add sign-in PDF download"
```

---

## Self-Review Notes

- **Spec coverage:** schema (Task 1), resolution logic incl. "unconfigured = empty" guard (Task 2), PDF incl. required pagination (Task 3), server/API wiring incl. Zod validation (Task 4), registry default picker (Task 5), dashboard display/override/download (Task 6) — every spec section has a task.
- **Type consistency verified:** `defaultParticipantDepts`/`defaultParticipantUserIds` (template) and `participantDepts`/`participantUserIds`/`participants` (occurrence) are spelled identically across types.ts, server.ts, both route files, and both components.
- **No placeholders:** every step shows complete code, not a description of what to write.
