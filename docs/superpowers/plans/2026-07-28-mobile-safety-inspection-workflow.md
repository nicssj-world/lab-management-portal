# Mobile Safety Inspection Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-handed mobile workflow for walking through safety-equipment inspections, with persistent progress, type-specific checks, explicit camera/gallery evidence, save-and-next navigation, and freely draggable map placement activated by a 250 ms long press.

**Architecture:** Split the current `SafetyAssetsClient.tsx` monolith into pure workflow/checklist domains and focused mobile components while keeping the existing desktop registry usable. Inspection rounds and checklist snapshots are persisted in Supabase; photo compression stays client-side before private R2 upload. `LabMapCanvas` gains an opt-in safety-marker drag contract copied from the equipment-map interaction pattern, while a dedicated position Route Handler enforces permission, optimistic concurrency, audit, viewBox bounds, and position re-verification.

**Tech Stack:** Next.js 16.2.6 App Router, React 19, TypeScript, Zod, Supabase/PostgreSQL, private R2 presigned uploads, XMLHttpRequest upload progress, SVG Pointer Events, native IndexedDB and BarcodeDetector feature detection.

## Global Constraints

- Every interactive control used during inspection must have a computed touch target of at least `44px × 44px`; the primary mobile action bar must account for `env(safe-area-inset-bottom)`.
- Preserve `compressSafetyPhoto()`: maximum image dimension `2048px`, JPEG output, target size `2.5 MB`, EXIF removal before requesting an upload URL.
- Preserve status, equipment-type, and room filters. The queue and progress counter must be calculated from the currently applied filters and the active inspection round.
- Preserve separate mobile List and Map views and add a third Inspect view. Switching views must not discard filters, queue order, list scroll position, form draft, selected equipment, or map viewport.
- A quick tap on a safety marker opens inspection details. A hold of at least `250 ms` arms dragging. Releasing before the delay must never move the marker. A completed drag must suppress the following click exactly once.
- Safety markers may be dragged freely anywhere inside the map viewBox (`x: 0..1477`, `y: 0..892`). Dropping over a room updates `spaceCode`; dropping in a corridor stores `spaceCode: null`.
- Moving a marker updates the working copy only, resets `position_status` to `unverified`, and does not change a published release snapshot until the existing release workflow publishes again.
- Every write requires `requireSafetyEditor()`, optimistic concurrency through `updatedAt`, and `auditSafety()`. Manager-only retirement rules remain unchanged.
- Keep private R2 validation: allow JPEG/PNG/WebP, verify magic bytes, and retain the 10 MB server-side ceiling.
- Do not add a camera, map, state-management, or offline dependency. Use existing components and browser APIs with supported fallbacks.
- Maintain keyboard selection, visible focus, ARIA live feedback, reduced motion, and non-color status labels.
- Before adding or changing Route Handlers, follow `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`; dynamic route `params` remain asynchronous.
- Do not stage or commit unrelated dirty-worktree files.

---

## File Structure

**Create**

- `lib/lab-map/safety-inspection-workflow.ts` — filtered queue construction, map-order sorting, progress, previous/next navigation.
- `lib/lab-map/safety-inspection-checklists.ts` — immutable checklist templates for all nine safety-equipment kinds and answer validation.
- `lib/lab-map/safety-inspection-drafts.ts` — native IndexedDB draft storage for form fields and compressed photo blobs.
- `components/lab-map/SafetyInspectionProgress.tsx` — progress header and current/remaining summary.
- `components/lab-map/SafetyInspectionMobile.tsx` — full-screen mobile inspection view and sticky actions.
- `components/lab-map/SafetyInspectionChecklist.tsx` — accessible type-specific checklist renderer.
- `components/lab-map/SafetyPhotoPicker.tsx` — explicit camera/gallery inputs, compression, preview, replacement, and progress UI.
- `components/lab-map/SafetyAssetScanner.tsx` — BarcodeDetector scanner with code-search fallback.
- `app/api/admin/lab-map/safety-inspection-rounds/route.ts` — create/list active rounds.
- `app/api/admin/lab-map/safety-inspection-rounds/[id]/route.ts` — close a round and read progress.
- `app/api/admin/lab-map/safety-assets/[id]/position/route.ts` — isolated map-position mutation.
- `supabase/migrations/20260728230000_safety_inspection_rounds_checklists.sql` — rounds, round items, checklist snapshots, and transactional finalize RPC.
- `scripts/lab-map-safety-workflow.test.ts` — pure queue/progress contract.
- `scripts/lab-map-safety-checklists.test.ts` — checklist coverage/validation contract.
- `scripts/lab-map-safety-position-api.test.ts` — position permission, validation, conflict, and audit contract.
- `scripts/lab-map-safety-mobile-flow.test.ts` — mobile view, touch target, sticky action, photo, next-item, and offline draft contract.

**Modify**

- `components/lab-map/SafetyAssetsClient.tsx` — orchestration only: filters, selected asset, active round, mobile view, optimistic positions, reload.
- `components/lab-map/LabMapCanvas.tsx` — opt-in safety marker drag and draft-marker callbacks.
- `components/lab-map/SafetyAssetsStyles.tsx` — mobile full-screen layout, 44px controls, sticky action bar, progress, preview, and drag states.
- `lib/lab-map/types.ts` — round, round-item, checklist, drag, and inspection snapshot DTOs.
- `lib/validations/lab-map-safety.ts` — round, checklist, inspection finalize, and position schemas.
- `lib/lab-map/safety-server.ts` — return checklist/round metadata and preserve latest-inspection derivation.
- `app/api/admin/lab-map/safety-assets/[id]/inspection-photo/route.ts` — finalize checklist and round item in the same transaction as inspection evidence.
- `scripts/lab-map-safety-module.sql` — keep fresh-install schema aligned with the migration.
- `scripts/lab-map-safety-schema.test.ts` — schema/RPC constraints.
- `scripts/lab-map-safety-api.test.ts` — new round and finalize contracts.
- `scripts/lab-map-safety-ui.test.ts` — mobile workflow and drag interaction source contracts.
- `README.md` — field workflow, map placement semantics, offline draft limits, and rollout commands.

---

### Task 1: Pure Inspection Queue and Navigation Domain

**Files:**
- Create: `lib/lab-map/safety-inspection-workflow.ts`
- Create: `scripts/lab-map-safety-workflow.test.ts`
- Modify: `lib/lab-map/types.ts`

**Interfaces:**
- Consumes: `SafetyAssetDTO[]`, `LabMapSpaceDTO[]`, `SafetyInspectionFilters`, and completed asset IDs from an active round.
- Produces: `buildSafetyInspectionQueue(input): SafetyInspectionQueue`, `nextSafetyAssetCode(queue, currentCode)`, and `previousSafetyAssetCode(queue, currentCode)`.

- [ ] **Step 1: Write the failing queue test**

```ts
import assert from 'node:assert/strict'
import { buildSafetyInspectionQueue, nextSafetyAssetCode, previousSafetyAssetCode } from '../lib/lab-map/safety-inspection-workflow'

const assets = [
  { id: 'b', code: 'ext-2', nameTh: 'ถัง 2', kind: 'fire-extinguisher', spaceCode: 'room-a', x: 200, y: 120, operationalStatus: 'overdue' },
  { id: 'a', code: 'ext-1', nameTh: 'ถัง 1', kind: 'fire-extinguisher', spaceCode: 'room-a', x: 100, y: 120, operationalStatus: 'overdue' },
  { id: 'c', code: 'aed-1', nameTh: 'AED', kind: 'aed', spaceCode: 'room-b', x: 20, y: 300, operationalStatus: 'passed' },
] as any

const queue = buildSafetyInspectionQueue({
  assets,
  filters: { query: '', status: 'overdue', kind: '', spaceCode: '' },
  completedAssetIds: new Set(['a']),
})
assert.deepEqual(queue.items.map(item => item.asset.code), ['ext-1', 'ext-2'])
assert.deepEqual(queue.progress, { completed: 1, total: 2, remaining: 1 })
assert.equal(nextSafetyAssetCode(queue, 'ext-1'), 'ext-2')
assert.equal(previousSafetyAssetCode(queue, 'ext-1'), 'ext-2')
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx tsx scripts/lab-map-safety-workflow.test.ts`

Expected: FAIL because `safety-inspection-workflow.ts` does not exist.

- [ ] **Step 3: Add the exact public types**

```ts
export interface SafetyInspectionFilters {
  query: string
  status: string
  kind: string
  spaceCode: string
}

export interface SafetyInspectionQueueItem {
  asset: SafetyAssetDTO
  completed: boolean
  sequence: number
}

export interface SafetyInspectionQueue {
  items: readonly SafetyInspectionQueueItem[]
  progress: { completed: number; total: number; remaining: number }
}
```

- [ ] **Step 4: Implement deterministic filtering and map order**

```ts
export function buildSafetyInspectionQueue({ assets, filters, completedAssetIds }: {
  assets: readonly SafetyAssetDTO[]
  filters: SafetyInspectionFilters
  completedAssetIds: ReadonlySet<string>
}): SafetyInspectionQueue {
  const query = filters.query.trim().toLocaleLowerCase('th')
  const filtered = assets.filter(asset =>
    (!query || `${asset.code} ${asset.nameTh} ${asset.sourceNoteTh ?? ''}`.toLocaleLowerCase('th').includes(query))
    && (!filters.status || asset.operationalStatus === filters.status)
    && (!filters.kind || asset.kind === filters.kind)
    && (!filters.spaceCode || asset.spaceCode === filters.spaceCode))
  const ordered = [...filtered].sort((a, b) =>
    (a.spaceCode ?? '').localeCompare(b.spaceCode ?? '', 'th', { numeric: true })
    || a.y - b.y || a.x - b.x || a.code.localeCompare(b.code, 'th', { numeric: true }))
  const items = ordered.map((asset, index) => ({ asset, completed: completedAssetIds.has(asset.id), sequence: index + 1 }))
  const completed = items.filter(item => item.completed).length
  return { items, progress: { completed, total: items.length, remaining: items.length - completed } }
}
```

Navigation wraps at the queue ends and returns `null` for an empty queue.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npx tsx scripts/lab-map-safety-workflow.test.ts && npx tsc --noEmit`

Expected: both commands exit `0`.

```bash
git add -- lib/lab-map/safety-inspection-workflow.ts lib/lab-map/types.ts scripts/lab-map-safety-workflow.test.ts
git commit -m "feat: add safety inspection queue domain"
```

---

### Task 2: Persistent Inspection Rounds and Checklist Snapshots

**Files:**
- Create: `supabase/migrations/20260728230000_safety_inspection_rounds_checklists.sql`
- Modify: `scripts/lab-map-safety-module.sql`
- Modify: `scripts/lab-map-safety-schema.test.ts`
- Modify: `lib/lab-map/types.ts`

**Interfaces:**
- Consumes: active safety asset IDs and a filter snapshot when a round starts.
- Produces: `SafetyInspectionRoundDTO`, ordered round items, optional `round_item_id` and immutable `checklist_snapshot` on inspections.

- [ ] **Step 1: Extend the schema contract first**

Add assertions for:

```ts
assert.match(sql, /create table if not exists public\.lab_map_safety_inspection_rounds/i)
assert.match(sql, /create table if not exists public\.lab_map_safety_inspection_round_items/i)
assert.match(sql, /checklist_snapshot jsonb not null default '\[\]'::jsonb/i)
assert.match(sql, /unique\s*\(round_id, asset_id\)/i)
assert.match(sql, /status text not null[^;]+open[^;]+closed/i)
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx scripts/lab-map-safety-schema.test.ts`

Expected: FAIL on the missing round tables.

- [ ] **Step 3: Add idempotent round tables and inspection columns**

```sql
create table if not exists public.lab_map_safety_inspection_rounds (
  id uuid primary key default gen_random_uuid(),
  name_th text not null,
  status text not null default 'open' check (status in ('open','closed')),
  filter_snapshot jsonb not null default '{}'::jsonb,
  started_by uuid not null references public.profiles(id),
  started_at timestamptz not null default now(),
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.lab_map_safety_inspection_round_items (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.lab_map_safety_inspection_rounds(id) on delete restrict,
  asset_id uuid not null references public.lab_map_safety_assets(id) on delete restrict,
  sequence_no integer not null check (sequence_no > 0),
  status text not null default 'pending' check (status in ('pending','completed','skipped')),
  inspection_id uuid references public.lab_map_safety_inspections(id) on delete restrict,
  completed_at timestamptz,
  unique (round_id, asset_id),
  unique (round_id, sequence_no)
);

alter table public.lab_map_safety_inspections
  add column if not exists round_item_id uuid references public.lab_map_safety_inspection_round_items(id) on delete restrict,
  add column if not exists checklist_snapshot jsonb not null default '[]'::jsonb;
```

Enable RLS, revoke `anon/authenticated`, grant only `service_role`, and add indexes for `(status, started_at desc)`, `(round_id, sequence_no)`, and `round_item_id`.

- [ ] **Step 4: Add DTOs with exact fields**

```ts
export interface SafetyInspectionRoundItemDTO {
  id: string
  assetId: string
  sequence: number
  status: 'pending' | 'completed' | 'skipped'
  inspectionId: string | null
}

export interface SafetyInspectionRoundDTO {
  id: string
  nameTh: string
  status: 'open' | 'closed'
  filters: SafetyInspectionFilters
  startedAt: string
  items: readonly SafetyInspectionRoundItemDTO[]
}
```

- [ ] **Step 5: Keep fresh-install SQL identical and verify GREEN**

Copy the same tables, columns, indexes, RLS, revoke, and grant statements into `scripts/lab-map-safety-module.sql`.

Run: `npx tsx scripts/lab-map-safety-schema.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -- supabase/migrations/20260728230000_safety_inspection_rounds_checklists.sql scripts/lab-map-safety-module.sql scripts/lab-map-safety-schema.test.ts lib/lab-map/types.ts
git commit -m "feat: persist safety inspection rounds"
```

---

### Task 3: Round APIs and Transactional Completion

**Files:**
- Create: `app/api/admin/lab-map/safety-inspection-rounds/route.ts`
- Create: `app/api/admin/lab-map/safety-inspection-rounds/[id]/route.ts`
- Modify: `lib/validations/lab-map-safety.ts`
- Modify: `app/api/admin/lab-map/safety-assets/[id]/inspection-photo/route.ts`
- Modify: `scripts/lab-map-safety-api.test.ts`
- Modify: `supabase/migrations/20260728230000_safety_inspection_rounds_checklists.sql`

**Interfaces:**
- Consumes: `{ nameTh, filters, orderedAssetIds }` and finalize payload `{ roundItemId, checklist }`.
- Produces: open round DTOs and atomic inspection + round-item completion.

- [ ] **Step 1: Write failing API source-contract assertions**

```ts
const rounds = read('app/api/admin/lab-map/safety-inspection-rounds/route.ts')
const round = read('app/api/admin/lab-map/safety-inspection-rounds/[id]/route.ts')
assert.match(rounds, /requireSafetyEditor/)
assert.match(rounds, /safetyInspectionRoundInputSchema/)
assert.match(rounds, /lab_map_safety_inspection_round_items/)
assert.match(round, /status:\s*'closed'/)
assert.match(photo, /roundItemId/)
assert.match(photo, /checklist/)
assert.match(photo, /record_lab_map_safety_inspection/)
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx scripts/lab-map-safety-api.test.ts`

Expected: FAIL because round routes are missing.

- [ ] **Step 3: Add strict Zod schemas**

```ts
export const safetyInspectionFiltersSchema = z.object({
  query: z.string().max(200), status: z.string().max(40), kind: z.string().max(40), spaceCode: z.string().max(80),
})
export const safetyInspectionRoundInputSchema = z.object({
  nameTh: z.string().trim().min(1).max(200),
  filters: safetyInspectionFiltersSchema,
  orderedAssetIds: z.array(z.string().uuid()).min(1).max(1000).refine(ids => new Set(ids).size === ids.length, 'อุปกรณ์ในรอบตรวจต้องไม่ซ้ำ'),
})
export const safetyChecklistAnswerSchema = z.object({
  key: z.string().min(1).max(80), labelTh: z.string().min(1).max(200), answer: z.enum(['pass','fail','na']), note: z.string().max(1000).nullish(),
})
```

Extend `inspectionFinalizeSchema` with `roundItemId: z.string().uuid().nullish()` and `checklist: z.array(safetyChecklistAnswerSchema).max(50)`.

- [ ] **Step 4: Create rounds transactionally**

The POST handler must load all requested active assets, reject missing/retired IDs with `422`, insert the round, insert ordered items, and delete the just-created round if item insertion fails. GET returns the actor-visible open round plus items ordered by `sequence_no`.

Use this response shape:

```ts
return NextResponse.json({
  data: { id: round.id, nameTh: round.name_th, status: round.status, filters: round.filter_snapshot, startedAt: round.started_at, items },
}, { status: 201 })
```

- [ ] **Step 5: Make finalize atomic in SQL**

Extend `record_lab_map_safety_inspection` with `p_round_item_id uuid` and `p_checklist_snapshot jsonb`. Lock the round item, require that it belongs to the same asset and is pending, insert the inspection, then update the item to completed with `inspection_id` and `completed_at`. When `p_round_item_id` is null, preserve the existing ad-hoc inspection path.

- [ ] **Step 6: Close only complete rounds**

PATCH `/safety-inspection-rounds/[id]` accepts `{ close: true }`, rejects any pending item with `422`, writes `closed_by/closed_at`, and audits `lab_map.safety_inspection_round.close`.

- [ ] **Step 7: Verify and commit**

Run: `npx tsx scripts/lab-map-safety-api.test.ts && npx tsx scripts/lab-map-safety-schema.test.ts && npx tsc --noEmit`

Expected: all exit `0`.

```bash
git add -- app/api/admin/lab-map/safety-inspection-rounds app/api/admin/lab-map/safety-assets/[id]/inspection-photo/route.ts lib/validations/lab-map-safety.ts scripts/lab-map-safety-api.test.ts supabase/migrations/20260728230000_safety_inspection_rounds_checklists.sql
git commit -m "feat: add safety inspection round APIs"
```

---

### Task 4: Type-Specific Safety Checklists

**Files:**
- Create: `lib/lab-map/safety-inspection-checklists.ts`
- Create: `scripts/lab-map-safety-checklists.test.ts`
- Create: `components/lab-map/SafetyInspectionChecklist.tsx`
- Modify: `lib/lab-map/types.ts`

**Interfaces:**
- Produces: `SAFETY_INSPECTION_CHECKLISTS`, `checklistForSafetyKind(kind)`, and `validateChecklistCompletion(template, answers)`.

- [ ] **Step 1: Write a failing coverage test for all nine kinds**

```ts
for (const kind of SAFETY_EQUIPMENT_KINDS) {
  const checklist = checklistForSafetyKind(kind)
  assert.ok(checklist.length >= 3, `${kind} needs at least three field checks`)
  assert.equal(new Set(checklist.map(item => item.key)).size, checklist.length)
}
assert.deepEqual(
  checklistForSafetyKind('fire-extinguisher').map(item => item.key),
  ['accessible','seal-pin','pressure','hose-nozzle','body-condition','expiry-label'],
)
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx scripts/lab-map-safety-checklists.test.ts`

Expected: FAIL because the checklist catalog does not exist.

- [ ] **Step 3: Define immutable templates**

Use `{ key, labelTh, required }` entries. Required checks are:

- fire extinguisher: accessible, seal/pin, pressure, hose/nozzle, body condition, expiry label.
- fire hose: access, cabinet, hose, nozzle/valve, leakage.
- manual call point: access, cover, label, indicator, physical condition.
- AED: access, power/self-test, battery, pads expiry, accessories.
- first-aid kit: access, seal/container, stock completeness, expiry, inventory label.
- eyewash: access, water flow, nozzle caps, cleanliness, drain.
- emergency shower: access, activation, flow, valve return, signage/drain.
- spill kit: access, seal, absorbent stock, PPE stock, waste bags/instructions.
- emergency shutoff: access, label, guard/cover, physical condition, test authorization recorded.

- [ ] **Step 4: Render 44px segmented answers**

Each checklist row renders its label plus three native buttons `ผ่าน`, `ไม่ผ่าน`, `ไม่เกี่ยวข้อง`, each with `aria-pressed`, `min-height:44px`, and an inline note input that appears when `answer === 'fail'`. Missing required answers render a `role="alert"` message directly below the row.

- [ ] **Step 5: Verify and commit**

Run: `npx tsx scripts/lab-map-safety-checklists.test.ts && npx tsc --noEmit`

```bash
git add -- lib/lab-map/safety-inspection-checklists.ts lib/lab-map/types.ts components/lab-map/SafetyInspectionChecklist.tsx scripts/lab-map-safety-checklists.test.ts
git commit -m "feat: add type-specific safety checklists"
```

---

### Task 5: Evidence Photo Picker with Camera, Gallery, Preview, and Progress

**Files:**
- Create: `components/lab-map/SafetyPhotoPicker.tsx`
- Modify: `components/lab-map/SafetyAssetsClient.tsx`
- Create: `scripts/lab-map-safety-mobile-flow.test.ts`
- Modify: `scripts/lab-map-safety-ui.test.ts`

**Interfaces:**
- Produces: `SafetyPhotoPicker({ file, disabled, uploadPercent, onChange })`.
- Consumes: `compressSafetyPhoto()` without changing its dimension or target-size constants.

- [ ] **Step 1: Write failing source-contract tests**

```ts
const picker = read('components/lab-map/SafetyPhotoPicker.tsx')
assert.match(picker, /capture="environment"/, 'camera action requests the rear camera')
assert.match(picker, /accept="image\/\*"/, 'gallery action accepts images')
assert.match(picker, /ถ่ายรูป/)
assert.match(picker, /เลือกจากคลัง/)
assert.match(picker, /URL\.createObjectURL/)
assert.match(picker, /URL\.revokeObjectURL/)
assert.match(picker, /compressSafetyPhoto/)
assert.match(picker, /uploadPercent/)
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx scripts/lab-map-safety-mobile-flow.test.ts`

Expected: FAIL because the extracted picker does not exist.

- [ ] **Step 3: Build two explicit source actions**

Render two labels styled as buttons. The camera input uses `accept="image/*" capture="environment"`; the gallery input uses `accept="image/*"` with no `capture`. Both call the same `selectPhoto(source)` compression path and clear their input value after selection.

- [ ] **Step 4: Add safe preview lifecycle**

Create a preview URL only for the compressed `file`, revoke the prior URL in the effect cleanup, render `<img alt="ตัวอย่างรูปหลักฐานก่อนบันทึก">`, and provide 44px `เปลี่ยนรูป` and `เอารูปออก` actions. Announce compression and upload progress with `aria-live="polite"`.

- [ ] **Step 5: Verify and commit**

Run: `npx tsx scripts/lab-map-safety-mobile-flow.test.ts && npx tsx scripts/lab-map-safety-ui.test.ts && npx tsc --noEmit`

```bash
git add -- components/lab-map/SafetyPhotoPicker.tsx components/lab-map/SafetyAssetsClient.tsx scripts/lab-map-safety-mobile-flow.test.ts scripts/lab-map-safety-ui.test.ts
git commit -m "feat: improve mobile safety photo evidence"
```

---

### Task 6: Mobile List, Map, and Inspect State Machine

**Files:**
- Create: `components/lab-map/SafetyInspectionProgress.tsx`
- Create: `components/lab-map/SafetyInspectionMobile.tsx`
- Modify: `components/lab-map/SafetyAssetsClient.tsx`
- Modify: `components/lab-map/SafetyAssetsStyles.tsx`
- Modify: `scripts/lab-map-safety-mobile-flow.test.ts`

**Interfaces:**
- Adds mobile view state: `type SafetyMobileView = 'list' | 'map' | 'inspect'`.
- Consumes: `SafetyInspectionQueue`, selected code, current draft, and callbacks `onBack`, `onPrevious`, `onConfirmAndNext`, `onShowMap`.

- [ ] **Step 1: Add failing mobile-flow assertions**

```ts
assert.match(client, /'list' \| 'map' \| 'inspect'/)
assert.match(client, /listScrollTopRef/)
assert.match(client, /SafetyInspectionProgress/)
assert.match(client, /SafetyInspectionMobile/)
assert.match(mobile, /ยืนยันและไปเครื่องถัดไป/)
assert.match(mobile, /กลับไปรายการ/)
assert.match(styles, /env\(safe-area-inset-bottom\)/)
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx scripts/lab-map-safety-mobile-flow.test.ts`

Expected: FAIL on the missing Inspect view.

- [ ] **Step 3: Replace inline mobile form insertion**

On widths below `768px`, selecting a list card sets `selectedCode`, records the list container `scrollTop`, and sets view to `inspect`. Back restores `list` and the exact saved scroll position in `requestAnimationFrame`. Desktop continues to render its existing split map/sidebar layout.

- [ ] **Step 4: Make map selection open Inspect directly**

`selectMap(code)` sets the selected asset and changes `map → inspect` when the code belongs to a safety asset. The Inspect header includes a 44px `ดูบนแผนที่` action which returns to Map without clearing the selected asset.

- [ ] **Step 5: Preserve filters and queue state**

Do not clear `selectedCode` merely because the mobile view changes. Continue clearing selection only when a status/type/room/search filter removes that asset from the queue. Render `ตรวจแล้ว X/Y · เหลือ Z` above both List and Inspect.

- [ ] **Step 6: Add sticky one-handed actions**

The Inspect footer is `position:sticky; bottom:0; padding-bottom:calc(12px + env(safe-area-inset-bottom));` and contains `บันทึกร่าง` plus the primary `ยืนยันและไปเครื่องถัดไป`. Each button is at least 48px high; no destructive action shares this bar.

- [ ] **Step 7: Verify and commit**

Run: `npx tsx scripts/lab-map-safety-mobile-flow.test.ts && npx tsx scripts/lab-map-safety-ui.test.ts && npx tsc --noEmit`

```bash
git add -- components/lab-map/SafetyInspectionProgress.tsx components/lab-map/SafetyInspectionMobile.tsx components/lab-map/SafetyAssetsClient.tsx components/lab-map/SafetyAssetsStyles.tsx scripts/lab-map-safety-mobile-flow.test.ts
git commit -m "feat: add mobile safety inspection flow"
```

---

### Task 7: Submission Feedback, Save-and-Next, and Round Completion

**Files:**
- Modify: `components/lab-map/SafetyInspectionMobile.tsx`
- Modify: `components/lab-map/SafetyAssetsClient.tsx`
- Modify: `components/lab-map/SafetyPhotoPicker.tsx`
- Modify: `scripts/lab-map-safety-mobile-flow.test.ts`

**Interfaces:**
- Produces: `submitInspection(draft, mode: 'stay' | 'next')` with visible phases `compressing | signing | uploading | finalizing | success | error`.

- [ ] **Step 1: Add failing feedback assertions**

```ts
assert.match(client, /uploadFileWithProgress\([^)]*setUploadPercent/s)
assert.match(mobile, /role="status"/)
assert.match(mobile, /บันทึกผลตรวจแล้ว/)
assert.match(mobile, /ลองอัปโหลดอีกครั้ง/)
assert.match(client, /nextSafetyAssetCode/)
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx scripts/lab-map-safety-mobile-flow.test.ts`

- [ ] **Step 3: Report every async phase**

Replace the empty upload callback `() => {}` with `setUploadPercent`. Disable duplicate submission, keep the form visible, and place any error beside the sticky action rather than only at the page top. Preserve the selected compressed file and entered answers after a network failure.

- [ ] **Step 4: Confirm and navigate**

After successful finalize, update the completed round item locally, show `บันทึกผลตรวจแล้ว`, clear only the completed asset draft, and open the next pending queue item. If none remain, show the completion summary with counts for passed, follow-up, failed, and not-found results plus a `ปิดรอบตรวจ` action.

- [ ] **Step 5: Verify and commit**

Run: `npx tsx scripts/lab-map-safety-mobile-flow.test.ts && npx tsx scripts/lab-map-safety-api.test.ts && npx tsc --noEmit`

```bash
git add -- components/lab-map/SafetyInspectionMobile.tsx components/lab-map/SafetyAssetsClient.tsx components/lab-map/SafetyPhotoPicker.tsx scripts/lab-map-safety-mobile-flow.test.ts
git commit -m "feat: add safety inspection save and next"
```

---

### Task 8: Dedicated Safety-Asset Position API

**Files:**
- Create: `app/api/admin/lab-map/safety-assets/[id]/position/route.ts`
- Create: `scripts/lab-map-safety-position-api.test.ts`
- Modify: `lib/validations/lab-map-safety.ts`
- Modify: `scripts/lab-map-safety-api.test.ts`

**Interfaces:**
- Consumes: `{ x: number, y: number, spaceCode: string | null, updatedAt: string }`.
- Produces: `{ id, x, y, spaceCode, positionStatus, updatedAt }`.

- [ ] **Step 1: Write failing API contract**

```ts
const route = read('app/api/admin/lab-map/safety-assets/[id]/position/route.ts')
assert.match(route, /requireSafetyEditor/)
assert.match(route, /safetyAssetPositionSchema/)
assert.match(route, /position_status:\s*'unverified'/)
assert.match(route, /position_verified_by:\s*null/)
assert.match(route, /status:\s*409/)
assert.match(route, /auditSafety\('lab_map\.safety_asset\.position'/)
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx scripts/lab-map-safety-position-api.test.ts`

Expected: FAIL because the route is missing.

- [ ] **Step 3: Add exact validation**

```ts
export const safetyAssetPositionSchema = z.object({
  x: z.number().min(0).max(1477),
  y: z.number().min(0).max(892),
  spaceCode: z.string().trim().min(1).max(80).nullable(),
  updatedAt: z.string().datetime({ offset: true }),
})
```

- [ ] **Step 4: Implement the isolated PATCH route**

Load the active asset and optional active room, reject a missing room with `422`, reject stale `updatedAt` with `409`, and update only `x`, `y`, `space_code`, position verification fields, and `updated_at`. Use `.eq('updated_at', parsed.data.updatedAt).select(...).maybeSingle()` as the second concurrency gate. Audit old and new coordinates without changing name, kind, lifecycle, inspection history, or the published release.

- [ ] **Step 5: Verify and commit**

Run: `npx tsx scripts/lab-map-safety-position-api.test.ts && npx tsx scripts/lab-map-safety-api.test.ts && npx tsc --noEmit`

```bash
git add -- app/api/admin/lab-map/safety-assets/[id]/position/route.ts lib/validations/lab-map-safety.ts scripts/lab-map-safety-position-api.test.ts scripts/lab-map-safety-api.test.ts
git commit -m "feat: add safety asset position endpoint"
```

---

### Task 9: Free Long-Press Dragging on the Safety Map

**Files:**
- Modify: `components/lab-map/LabMapCanvas.tsx`
- Modify: `components/lab-map/SafetyAssetsClient.tsx`
- Modify: `components/lab-map/SafetyAssetsStyles.tsx`
- Modify: `scripts/lab-map-safety-ui.test.ts`

**Interfaces:**
- Adds `onMoveSafetyEquipment?: (input: { id: string; code: string; x: number; y: number; spaceCode: string | null }) => void` to `LabMapCanvasProps`.
- Keeps `onSelect(code)` for quick taps and existing keyboard behavior.

- [ ] **Step 1: Add failing gesture assertions based on the equipment map**

```ts
assert.match(canvas, /const SAFETY_DRAG_HOLD_MS = 250/)
assert.match(canvas, /pendingSafetyDragRef/)
assert.match(canvas, /setPointerCapture/)
assert.match(canvas, /suppressSafetyClickRef/)
assert.match(canvas, /Math\.max\(0, Math\.min\(1477/)
assert.match(canvas, /document\.elementsFromPoint/)
assert.match(canvas, /onMoveSafetyEquipment\?\./)
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx scripts/lab-map-safety-ui.test.ts`

- [ ] **Step 3: Copy the proven delayed-drag state model**

Add pending drag, armed drag, preview, timer, and one-shot click suppression refs. Pointer down on `[data-equipment-code]` stops map panning, captures the pointer, and starts a 250ms timer. Pointer move does nothing until armed. Pointer up before arming clears the timer and allows click selection. Pointer up after a changed preview emits rounded coordinates and suppresses the next click once.

- [ ] **Step 4: Allow free viewBox movement and resolve room**

Transform client coordinates through the current SVG viewport and pan/zoom matrix, clamp to the full viewBox, and do not constrain movement to the old room. Resolve `spaceCode` from `document.elementsFromPoint(clientX, clientY)` by finding the first underlying `[data-space-code]`; use `null` when the drop point is a corridor.

- [ ] **Step 5: Render clear drag feedback**

During the 250ms hold, add `data-drag-pending`; when armed add `data-dragging`. Enlarge the marker halo without changing layout, set `touch-action:none` only on the active marker, and announce `ลากเพื่อย้ายตำแหน่ง ปล่อยเพื่อบันทึก` with a polite live region. Reduced-motion mode disables pulse animation but not the state label.

- [ ] **Step 6: Add optimistic UI and rollback**

`SafetyAssetsClient` immediately stores the preview position by asset ID, calls the dedicated position route, replaces `updatedAt` with the returned value, and reloads in the background. On failure it restores the prior x/y/space and shows an inline retry action. Do not disable map panning for other pointers after the drag ends.

- [ ] **Step 7: Verify and commit**

Run: `npx tsx scripts/lab-map-safety-ui.test.ts && npx tsx scripts/lab-map-safety-position-api.test.ts && npx tsc --noEmit`

```bash
git add -- components/lab-map/LabMapCanvas.tsx components/lab-map/SafetyAssetsClient.tsx components/lab-map/SafetyAssetsStyles.tsx scripts/lab-map-safety-ui.test.ts
git commit -m "feat: add long press safety marker dragging"
```

---

### Task 10: New-Asset Placement with a Draggable Draft Marker

**Files:**
- Modify: `components/lab-map/LabMapCanvas.tsx`
- Modify: `components/lab-map/SafetyAssetsClient.tsx`
- Modify: `scripts/lab-map-safety-ui.test.ts`

**Interfaces:**
- Adds `draftSafetyEquipment?: Pick<LabSafetyEquipmentDefinition, 'code' | 'nameTh' | 'kind' | 'x' | 'y'> | null` and `onMoveDraftSafetyEquipment?: ({ x, y, spaceCode }) => void`.

- [ ] **Step 1: Add failing draft-marker assertions**

```ts
assert.match(canvas, /draftSafetyEquipment/)
assert.match(canvas, /onMoveDraftSafetyEquipment/)
assert.match(client, /วางหมุดอุปกรณ์/)
assert.match(client, /ยืนยันตำแหน่งนี้/)
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx scripts/lab-map-safety-ui.test.ts`

- [ ] **Step 3: Replace raw X/Y entry as the primary mobile path**

When adding an asset, default the draft marker to the viewBox center, switch to Map, and show instructions `ลากหมุดไปยังตำแหน่งจริง`. The marker uses the same 250ms drag machinery and free viewBox bounds. Keep numeric X/Y fields only inside a collapsed `พิกัดขั้นสูง` section for desktop recovery.

- [ ] **Step 4: Confirm position before creating**

The map footer shows room/corridor, rounded x/y, `ยกเลิก`, and `ยืนยันตำแหน่งนี้`. Confirmation writes x/y/spaceCode back to the draft and opens the asset editor; the final POST remains the existing `/safety-assets` creation path.

- [ ] **Step 5: Verify and commit**

Run: `npx tsx scripts/lab-map-safety-ui.test.ts && npx tsc --noEmit`

```bash
git add -- components/lab-map/LabMapCanvas.tsx components/lab-map/SafetyAssetsClient.tsx scripts/lab-map-safety-ui.test.ts
git commit -m "feat: add draggable safety asset placement"
```

---

### Task 11: Offline Draft Recovery and QR/Code Entry

**Files:**
- Create: `lib/lab-map/safety-inspection-drafts.ts`
- Create: `components/lab-map/SafetyAssetScanner.tsx`
- Modify: `components/lab-map/SafetyInspectionMobile.tsx`
- Modify: `components/lab-map/SafetyAssetsClient.tsx`
- Modify: `scripts/lab-map-safety-mobile-flow.test.ts`

**Interfaces:**
- Produces: `saveSafetyInspectionDraft`, `loadSafetyInspectionDraft`, `deleteSafetyInspectionDraft`, and scanner callback `onCode(code: string)`.

- [ ] **Step 1: Write failing resilience assertions**

```ts
const drafts = read('lib/lab-map/safety-inspection-drafts.ts')
assert.match(drafts, /indexedDB\.open/)
assert.match(drafts, /compressedPhoto/)
assert.match(mobile, /navigator\.onLine/)
assert.match(scanner, /BarcodeDetector/)
assert.match(scanner, /กรอกรหัสอุปกรณ์/)
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx scripts/lab-map-safety-mobile-flow.test.ts`

- [ ] **Step 3: Persist drafts per round and asset**

Use database `lab-safety-inspection-v1`, object store `drafts`, and key `${roundId ?? 'adhoc'}:${assetId}`. Store result, dates, note, checklist answers, compressed photo Blob/name/type, and `savedAt`. Auto-save after 500ms of inactivity; restore only after showing `พบแบบตรวจที่บันทึกไว้ในเครื่อง` with `ใช้แบบร่าง` and `เริ่มใหม่` choices.

- [ ] **Step 4: Handle offline submission safely**

When offline, keep the sticky primary action disabled with text `รอเชื่อมต่อเพื่อส่งผลตรวจ`, but keep `บันทึกร่างในเครื่อง` enabled. Do not cache presigned URLs and do not automatically upload after reconnection; when the `online` event fires, show `กลับมาออนไลน์แล้ว — แตะยืนยันเพื่อส่ง`.

- [ ] **Step 5: Add scanner with fallback**

If `BarcodeDetector` supports `qr_code` or `code_128`, open the rear camera only after the user presses `สแกนรหัส`. Stop all media tracks on success, cancel, view change, and component unmount. If unavailable or denied, keep a 44px code input and `เปิดอุปกรณ์` button that performs exact case-insensitive code matching.

- [ ] **Step 6: Verify and commit**

Run: `npx tsx scripts/lab-map-safety-mobile-flow.test.ts && npx tsc --noEmit`

```bash
git add -- lib/lab-map/safety-inspection-drafts.ts components/lab-map/SafetyAssetScanner.tsx components/lab-map/SafetyInspectionMobile.tsx components/lab-map/SafetyAssetsClient.tsx scripts/lab-map-safety-mobile-flow.test.ts
git commit -m "feat: add resilient safety field drafts"
```

---

### Task 12: Responsive, Accessibility, Documentation, and Release Gate

**Files:**
- Modify: `components/lab-map/SafetyAssetsStyles.tsx`
- Modify: `scripts/lab-map-safety-ui.test.ts`
- Modify: `scripts/lab-map-safety-mobile-flow.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes all previous tasks.
- Produces a documented, deployable workflow with automated and manual acceptance gates.

- [ ] **Step 1: Lock touch and responsive contracts**

```ts
assert.match(styles, /--safety-touch-target:\s*44px/)
assert.match(styles, /min-height:\s*var\(--safety-touch-target\)/)
assert.match(styles, /@media\s*\(max-width:\s*767px\)/)
assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
assert.doesNotMatch(styles, /font-size:\s*(?:10|11|12)px[^}]*safety-inspection-mobile/, 'mobile inspection body copy must be at least 14px')
```

- [ ] **Step 2: Verify RED if any contract remains unmet**

Run: `npx tsx scripts/lab-map-safety-mobile-flow.test.ts`

- [ ] **Step 3: Finish mobile styles without removing desktop behavior**

Define `--safety-touch-target:44px`; use at least 16px for form values, 14px for supporting text, visible 3px focus outlines, single page scrolling in Inspect, and no nested scrolling in the mobile queue. Test widths `320`, `375`, `390`, `768`, `1024`, and `1440` CSS pixels. Keep status text alongside color badges.

- [ ] **Step 4: Document exact operator workflow**

README must describe: starting/closing a round, filter-aware queue order, List/Map/Inspect behavior, camera/gallery and compression, save-and-next, offline draft limits, scanner fallback, 250ms long press, free map placement, corridor drops, optimistic rollback, position re-verification, and published-snapshot separation.

- [ ] **Step 5: Apply migration in staging and run full automated gate**

Run:

```bash
npx tsx scripts/lab-map-safety-workflow.test.ts
npx tsx scripts/lab-map-safety-checklists.test.ts
npx tsx scripts/lab-map-safety-position-api.test.ts
npx tsx scripts/lab-map-safety-mobile-flow.test.ts
npx tsx scripts/lab-map-safety-ui.test.ts
npx tsx scripts/lab-map-safety-api.test.ts
npx tsx scripts/lab-map-safety-schema.test.ts
npx tsx scripts/lab-map-assembly-points.test.ts
npx tsc --noEmit
git diff --check
npm run build
```

Expected: every command exits `0`; Next build completes all route generation.

- [ ] **Step 6: Run manual field acceptance on two physical phones**

On one iPhone/Safari and one Android/Chrome, verify:

1. Every inspection control is comfortably tappable with one hand.
2. Status/type/room filters persist across List → Map → Inspect → List.
3. List scroll position returns exactly after inspecting an item.
4. Camera and gallery both work; preview can be replaced; compression and upload percentages are visible.
5. A failed upload preserves the form and photo and offers retry.
6. `ยืนยันและไปเครื่องถัดไป` advances once and progress increments once.
7. Quick marker tap opens Inspect without moving; hold under 250ms does not move; hold at least 250ms then drag moves freely.
8. Dropping in a different room changes room; dropping in a corridor clears room; failed save rolls back visually.
9. Pinch/Drag of the map still works when starting away from a marker.
10. Moving working-copy equipment does not alter the published safety map until a new release is published.
11. Offline form changes restore from IndexedDB; submission waits for an explicit tap after reconnection.
12. Keyboard Enter/Space, focus order, screen-reader status, and reduced motion remain usable.

- [ ] **Step 7: Commit documentation and release gates**

```bash
git add -- components/lab-map/SafetyAssetsStyles.tsx scripts/lab-map-safety-ui.test.ts scripts/lab-map-safety-mobile-flow.test.ts README.md
git commit -m "docs: finalize mobile safety inspection workflow"
```

---

## Milestone Acceptance

### Milestone A — Walkable Queue

- Tasks 1–3 and 6–7 complete.
- Staff can start a round, filter it, inspect sequentially, see progress, save-and-next, and close a complete round.

### Milestone B — Reliable Evidence and Equipment-Specific Checks

- Tasks 4–5 complete.
- All nine equipment types have persisted checklist snapshots; camera/gallery, preview, compression, progress, retry, and inline feedback work.

### Milestone C — Map Placement

- Tasks 8–10 complete.
- Existing and new markers use quick-tap selection plus 250ms long-press free dragging with permission, audit, concurrency, optimistic rollback, and re-verification.

### Milestone D — Field Resilience and Release

- Tasks 11–12 complete.
- Local drafts, online recovery, QR/code lookup, accessibility, responsive verification, documentation, migration rollout, and production build gates pass.
