# Grouped Calibration Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support grouped and individual annual PM/CAL plans, with legacy-template and prior-year-copy starting options.

**Architecture:** A new group header owns shared schedule and group-level money, while the existing per-equipment plan rows become members and retain their results/certificates. Drafts are generated from read-only legacy data or a chosen prior fiscal year and are only persisted after review.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Supabase/Postgres, `tsx` contract tests.

## Global Constraints

- Preserve `calibration_plans` as read-only legacy/template source; never auto-import guessed equipment links.
- All protected routes use `getPmCalActor`; mutations use audit logging and service-role database access.
- Group price mode is `per_unit` or `lump_sum`; lump-sum planned and actual amounts are totaled once, never allocated to members.
- Keep the active `(equipment_id, fiscal_year, calendar_month, cal_type)` uniqueness rule and report conflicts before writing.
- Do not delete a group with a member result or certificate; only cancel groups without member results.
- Accept Thai fiscal years 2500–3000, not just adjacent years.
- Work directly on `main`; stage only files introduced by each task.

---

### Task 1: Add group persistence and database safety

**Files:**

- Create: `supabase/migrations/<timestamp>_pm_cal_plan_groups.sql`
- Modify: `scripts/pm-cal-history.sql`
- Modify: `scripts/pm-cal-history-schema.test.ts`

**Interfaces:**

- Creates `equipment_pm_cal_plan_groups` with fiscal year, group/title, PM/CAL schedule, provider, price mode, unit/planned/actual amounts, status, version, and audit columns.
- Adds nullable `equipment_pm_cal_plans.plan_group_id`.
- Creates `replace_equipment_pm_cal_plan_group(p_group jsonb, p_members jsonb, p_expected_versions jsonb, p_actor uuid)` and `cancel_equipment_pm_cal_plan_group(p_group_id uuid, p_version integer, p_actor uuid)`.

- [ ] Write failing schema assertions for the group table, price-mode constraint, group foreign key, two RPCs, `security invoker`, and the rejection text `group has member results`.
- [ ] Run `npx tsx scripts/pm-cal-history-schema.test.ts`; expect failure.
- [ ] Implement the additive migration. Use this constraint and member cost rule:

```sql
price_mode text not null check (price_mode in ('per_unit', 'lump_sum')),
unit_price numeric(12,2),
planned_amount numeric(12,2) not null check (planned_amount >= 0),
actual_amount numeric(12,2) check (actual_amount is null or actual_amount >= 0),
check ((price_mode = 'per_unit' and unit_price is not null)
    or (price_mode = 'lump_sum' and unit_price is null));
-- per_unit member planned_cost = unit_price; lump_sum member planned_cost = null
```

  The replace RPC locks the header and selected equipment, validates fiscal-date mapping and duplicate schedules, upserts header/members, and cancels removed members only when they have no result. The cancel RPC cancels header and active members only when no member has `equipment_calibrations.plan_id`.
- [ ] Run `npx tsx scripts/pm-cal-history-schema.test.ts` and `git diff --check`; expect success.
- [ ] Commit: `git add supabase/migrations/<timestamp>_pm_cal_plan_groups.sql scripts/pm-cal-history.sql scripts/pm-cal-history-schema.test.ts && git commit -m "feat: add grouped PM/CAL plan schema"`.

### Task 2: Add validation, draft sources, and group-aware reporting

**Files:**

- Create: `lib/equipment/pm-cal-groups.ts`
- Create: `lib/equipment/pm-cal-groups.test.ts`
- Modify: `lib/equipment/pm-cal-validation.ts`
- Modify: `lib/equipment/pm-cal-report.ts`
- Modify: `lib/equipment/pm-cal-report.test.ts`

**Interfaces:**

```ts
export type PlanGroupDraft = { fiscal_year: number; group_name: string; plan_name: string;
  cal_type: 'PM' | 'CAL'; calendar_month: number; due_date: string; provider: string | null;
  price_mode: 'per_unit' | 'lump_sum'; unit_price: number | null; planned_amount: number;
  actual_amount: null; equipment_ids: string[]; status: 'draft' }
export function buildPlanGroupDrafts(
  source: 'legacy_template' | 'fiscal_year', targetFiscalYear: number, sourceGroups?: PlanGroup[],
): PlanGroupDraft[]
```

- [ ] Write failing tests: per-unit price `1500 × 3 = 4500`; lump sum stays `1500`; legacy drafts have no members; copied groups clear actual amounts/member IDs; a group plus individual report totals money exactly once.
- [ ] Run `npx tsx lib/equipment/pm-cal-groups.test.ts && npx tsx lib/equipment/pm-cal-report.test.ts`; expect failure.
- [ ] Implement `pmCalPlanGroupReplaceSchema` with `equipment_ids: z.array(z.string().uuid()).min(1)`, strict fiscal-month due date validation, and price-mode validation. Make legacy/template and copied rows unsaved drafts; never copy results, certificates, actual amounts, IDs, or versions.
- [ ] Extend `buildPmCalReport` to accept groups. Count all active member plans for statuses but sum group planned/actual amounts once and individual plan/result costs only when `plan_group_id` is null.
- [ ] Run both focused tests; expect success.
- [ ] Commit: `git add lib/equipment/pm-cal-groups.ts lib/equipment/pm-cal-groups.test.ts lib/equipment/pm-cal-validation.ts lib/equipment/pm-cal-report.ts lib/equipment/pm-cal-report.test.ts && git commit -m "feat: add grouped PM/CAL planning domain"`.

### Task 3: Add protected group and annual-draft APIs

**Files:**

- Create: `app/api/admin/equipment/pm-cal/groups/route.ts`
- Create: `app/api/admin/equipment/pm-cal/groups/[groupId]/route.ts`
- Create: `app/api/admin/equipment/pm-cal/drafts/route.ts`
- Modify: `app/api/admin/equipment/pm-cal/report/route.ts`
- Modify: `app/api/admin/equipment/[id]/pm-cal/route.ts`
- Modify: `scripts/pm-cal-api.test.ts`

**Interfaces:**

- `GET/POST /api/admin/equipment/pm-cal/groups`
- `PATCH/DELETE /api/admin/equipment/pm-cal/groups/:groupId`
- `GET /api/admin/equipment/pm-cal/drafts?targetFiscalYear=2570&source=legacy_template`
- `GET /api/admin/equipment/pm-cal/drafts?targetFiscalYear=2570&source=fiscal_year&sourceFiscalYear=2569`

- [ ] Write failing route contract tests covering `getPmCalActor`, `pmCalPlanGroupReplaceSchema.safeParse`, group RPCs, `409`, `legacy_template`, `sourceFiscalYear`, and group fetch in the report route.
- [ ] Run `npx tsx scripts/pm-cal-api.test.ts`; expect failure.
- [ ] Implement read/edit permission handling, 422 validation responses, 409 version/schedule conflicts with equipment code/name, and audit events for group create/update/cancel. Return eligible equipment selector data from the group GET. Existing individual PUT must return 409 for grouped members, while its GET includes read-only group context.
- [ ] Draft endpoints return only data from `buildPlanGroupDrafts`; they never persist or write an audit entry. The reports route loads groups and passes them to the domain builder.
- [ ] Run `npx tsx scripts/pm-cal-api.test.ts && npx tsx lib/equipment/pm-cal-report.test.ts`; expect success.
- [ ] Commit: `git add app/api/admin/equipment/pm-cal/groups app/api/admin/equipment/pm-cal/drafts app/api/admin/equipment/pm-cal/report/route.ts app/api/admin/equipment/[id]/pm-cal/route.ts scripts/pm-cal-api.test.ts && git commit -m "feat: add grouped PM/CAL plan APIs"`.

### Task 4: Build the annual planning workspace

**Files:**

- Create: `components/equipment/PmCalPlanWorkspace.tsx`
- Create: `components/equipment/GroupedPmCalPlanModal.tsx`
- Modify: `app/(protected)/staff/equipment/EquipmentClient.tsx`
- Modify: `components/equipment/EquipmentPmCalModal.tsx`
- Modify: `scripts/pm-cal-ui.test.ts`

**Interfaces:**

```ts
export function PmCalPlanWorkspace({ canEdit }: { canEdit: boolean }): JSX.Element
export function GroupedPmCalPlanModal(props: {
  fiscalYear: number; initialDraft?: PlanGroupDraft; canEdit: boolean;
  onClose(): void; onSaved(): Promise<void> | void;
}): JSX.Element
```

- [ ] Write failing UI contract assertions for `เริ่มจากแม่แบบเดิม`, `คัดลอกจากแผนปีก่อน`, arbitrary `targetFiscalYear`, `ราคาต่อหน่วย`, `ราคาเหมารวม`, `เลือกเครื่องมือ`, `จำนวนแผน`, and `แผนกลุ่ม` in the individual modal.
- [ ] Run `npx tsx scripts/pm-cal-ui.test.ts`; expect failure.
- [ ] Replace the inline current report tab with `PmCalPlanWorkspace` while retaining the Legacy 2566 tab. The workspace supports a typed fiscal-year field constrained to 2500–3000, legacy draft load, source-year selection/copy, and saved group/individual rows.
- [ ] Implement a searchable equipment picker displaying code, name, and department. `จำนวนแผน` is selected IDs length; per-unit total is locked to `count × unitPrice`; lump-sum accepts one planned/actual amount. Group expansion lists member status/result counts. The planning table retains legacy columns: Group, Item, Plan, Actual, Price, Budget.
- [ ] Show a group label in `EquipmentPmCalModal`, make group schedule/provider controls read-only, and preserve member result/certificate actions. Keep ungrouped individual behavior and expose an individual-plan action from the workspace.
- [ ] Run `npx tsx scripts/pm-cal-ui.test.ts && npx tsc --noEmit && npm run build`; expect success.
- [ ] Commit: `git add components/equipment/PmCalPlanWorkspace.tsx components/equipment/GroupedPmCalPlanModal.tsx app/(protected)/staff/equipment/EquipmentClient.tsx components/equipment/EquipmentPmCalModal.tsx scripts/pm-cal-ui.test.ts && git commit -m "feat: add grouped calibration plan workspace"`.

### Task 5: Document database rollout and verify the full change

**Files:**

- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-28-grouped-calibration-plans-design.md`

- [ ] Document the migration order, group/individual modes, two new-year starting options, and that legacy 2566 data is read-only/excluded from operational totals.
- [ ] Run the complete focused suite:

```bash
npx tsx scripts/pm-cal-history-schema.test.ts
npx tsx scripts/pm-cal-api.test.ts
npx tsx scripts/pm-cal-ui.test.ts
npx tsx lib/equipment/pm-cal-groups.test.ts
npx tsx lib/equipment/pm-cal-report.test.ts
npx tsc --noEmit
npm run build
```

  Expected: every command exits 0.
- [ ] Run `git diff --check` and `git status --short`; stage only this task’s docs.
- [ ] Commit: `git add README.md docs/superpowers/specs/2026-07-28-grouped-calibration-plans-design.md && git commit -m "docs: explain grouped calibration plan rollout"`.
