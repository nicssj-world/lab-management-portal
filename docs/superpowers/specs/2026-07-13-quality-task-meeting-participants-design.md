# Quality Tasks — Meeting Participants + Sign-in Sheet PDF

## Goal

Let each quality-task activity/meeting have a configurable audience of expected participants (by department and/or individual), settable as a template-level default with a per-occurrence override, and let anyone viewing an occurrence download a pre-filled sign-in sheet PDF matching the existing FM-QP-LAB-25-01 form (`เอกสารนี้เป็นสมบัติของกลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี` / "แบบบันทึกใบลงนามรับทราบการสื่อสารเพื่อการพัฒนา") for them to physically sign at the meeting.

Applies to every activity (both `taskKind: 'activity'` and `'meeting'`), not just meeting-flagged ones.

## Schema — `scripts/quality-task-participants.sql` (new script, run manually per project convention)

```sql
alter table public.quality_task_templates
  add column if not exists default_participant_depts text[],
  add column if not exists default_participant_user_ids uuid[];

alter table public.quality_task_instances
  add column if not exists participant_depts text[],
  add column if not exists participant_user_ids uuid[];
```

No FK constraint on the `uuid[]` columns — same accepted trade-off `documents.read_audience_user_ids` already has (array elements can't be FK'd in Postgres). Both new instance columns default to `null`/empty and represent "no override configured yet," distinct from "explicitly overridden."

## Resolution logic — new `lib/quality-tasks/participants.ts`

Two small, independently testable pure functions (same file convention as `lib/documents/read-audience.ts`).

**Override-wins selection** — mirrors `resolveAssigneeIds` in `lib/quality-tasks/logic.ts` exactly: a non-empty override replaces the default wholesale (not merged); an empty override means "no override, use the default."

```ts
export function resolveParticipantSelection(
  defaultDepts: string[], defaultUserIds: string[],
  overrideDepts: string[], overrideUserIds: string[],
): { depts: string[]; userIds: string[] } {
  const useOverride = overrideDepts.length > 0 || overrideUserIds.length > 0
  return useOverride
    ? { depts: overrideDepts, userIds: overrideUserIds }
    : { depts: defaultDepts, userIds: defaultUserIds }
}
```

**Resolve selection to actual people** — reuses `resolveReadAudience` from `lib/documents/read-audience.ts` (already generic, no documents-specific logic inside it), imported across the `lib/documents` → `lib/quality-tasks` boundary. Departs from that function's own "nothing selected = everyone" default: for meeting participants, nothing configured must resolve to an **empty** list, not the entire staff roster.

```ts
export function resolveParticipants<T extends { id: string; dept: string | null }>(
  people: T[], depts: string[], userIds: string[],
): T[] {
  if (depts.length === 0 && userIds.length === 0) return []
  return resolveReadAudience(people, depts, userIds)
}
```

## Server (`lib/quality-tasks/server.ts`)

- `getQualityTaskTemplates`: select the two new `default_participant_*` columns; map onto `QualityTaskTemplate.defaultParticipantDepts` / `defaultParticipantUserIds` (`string[]`, default `[]`).
- Template create/update routes (`app/api/admin/quality-tasks/templates/route.ts` and `[id]/route.ts`): accept `defaultParticipantDepts`/`defaultParticipantUserIds` in the same request body the template form already posts (`{...draft, schedules...}`) — no new route.
- `listTaskPeople()`: extend `.select('id,name,dept,role')` to `.select('id,name,dept,role,document_position')`.
- Occurrence generation (`getQualityTaskOccurrences` and the single-occurrence lookup path): compute `participants` per occurrence using `resolveParticipantSelection` (template default vs. instance override, same pattern already used for `assigneeIds`) then `resolveParticipants(people, ...)`, producing `QualityTaskOccurrence.participants: { id: string; name: string; documentPosition: string | null }[]`. Resolution happens server-side so the client never needs the dept-matching logic to render anything.
- Occurrence `schedule` action (`PATCH /api/admin/quality-tasks/occurrences/[id]`, existing `OccurrenceActionPayload`): accept optional `participantDepts`/`participantUserIds` alongside the existing `assigneeIds`, gated identically (`level === 'edit'` only, else 403) — no new route.

## Types (`lib/quality-tasks/types.ts`)

- `QualityTaskTemplate`: add `defaultParticipantDepts: string[]`, `defaultParticipantUserIds: string[]`.
- `QualityTaskOccurrence`: add `participantDepts: string[]`, `participantUserIds: string[]` (the raw override arrays, for populating the picker's current state) and `participants: { id: string; name: string; documentPosition: string | null }[]` (the resolved list, ready to render/print).
- `OccurrenceActionPayload`'s `'schedule'` variant: add optional `participantDepts?: string[]`, `participantUserIds?: string[]`.

## UI

**Registry template modal (`components/quality-tasks/QualityTaskRegistry.tsx`)** — add a "ผู้เข้าร่วมประชุม (ค่าเริ่มต้น)" field to the edit form: a department-group checkbox tree + individual-person toggle, the same interaction already built in `ReadReportClient.tsx`'s assign modal. Built as a local implementation in this file (not extracted to `components/ui`, since it's two call sites total and each already has its own local modal state shape).

**Occurrence detail modal (`components/quality-tasks/QualityTaskDashboard.tsx`, the `selected` panel)**:
- Show resolved participant count + names (read-only) next to the existing "ผู้รับผิดชอบ" info block.
- `level === 'edit'` only: an override picker (same widget) that writes to `participantDepts`/`participantUserIds` via the existing `mutate(selected, { action: 'schedule', ... })` path, mirroring how "ผู้รับผิดชอบงวดนี้" already works.
- A **"ดาวน์โหลด PDF ใบลงนาม"** button, shown whenever `selected.participants.length > 0`, visible to anyone who can open the occurrence (no extra permission gate — it's not more sensitive than the assignee list already shown).

## PDF — new `lib/quality-tasks/participant-sign-in-pdf.ts`

Client-side HTML-blob → `window.open` → auto-print, the same pattern `MasterListClient.tsx` already uses (`@page` CSS, TH Sarabun New font stack, blob URL revoked after print). One static template matching the attached FM-QP-LAB-25-01 exactly — same title, watermark ("กลุ่มงานเทคนิคการแพทย์" / "โรงพยาบาลชลบุรี" diagonal), form code (`Fm-QP-LAB-25/01`), and footer notice — reused unchanged for every activity/occurrence.

Only the table body is data-driven:
- ลำดับที่: sequential 1, 2, 3…
- ชื่อ - สกุล: `participant.name`
- ตำแหน่ง: `participant.documentPosition` (blank if not set on the profile)
- ลายเซ็นต์ / วัน เดือน ปี / หมายเหตุ: blank, for physical sign-in
- หน่วยงาน / การประชุม / เรื่อง header lines: blank, for manual fill-in at print time

Rows per page fixed at 20 (matching the sample's row count). Participant lists can realistically exceed one page — e.g. CBH-QT-44 ("การประชุมหัวหน้าห้องปฏิบัติการ/บุคลากรทั้งกลุ่มงาน") could resolve to the entire staff roster if all departments are selected as its default audience — so pagination is a real requirement, not an edge case: every page after the first repeats the header/watermark/footer, and only the last page pads with blank walk-in rows (same "paginate by filling blank rows on non-last pages" rule CLAUDE.md documents for the existing revision-history and master-list PDFs).

## Permissions

- Setting the template default: same gate as editing the template today (`level === 'edit'`).
- Overriding per occurrence: same gate as editing assignees today (`level === 'edit'`).
- Downloading the PDF: no extra gate beyond viewing the occurrence.

## Out of scope

- Ad-hoc names for people not in `profiles` (external/non-staff attendees) — the sheet's blank walk-in rows cover this on paper; no system support for typing in an external name.
- Auto-filling the หน่วยงาน / การประชุม / เรื่อง header lines — left blank per explicit decision.
- Extracting the department-checkbox-tree picker into a shared `components/ui` component — deferred until a third call site exists.
- Any change to the existing "ผู้รับผิดชอบ" (assignee) concept — participants are an entirely separate list from assignees, tracked in new columns, not reusing `quality_task_default_assignees` / `quality_task_instance_assignees`.

## Verification

- Configure a template default (one department + one extra individual) → confirm resolution; confirm an unconfigured template resolves to an empty participant list (not everyone).
- Override participants on one occurrence → confirm only that occurrence changes; sibling occurrences of the same template keep using the default.
- Download the PDF for a small resolved audience (< 20) → single page, correct names/positions in order, remaining rows blank.
- Download the PDF for a resolved audience > 20 (e.g., select every department) → confirms multi-page pagination, header/watermark/footer repeat per page, only the final page has blank rows.
- `npx tsc --noEmit`.
