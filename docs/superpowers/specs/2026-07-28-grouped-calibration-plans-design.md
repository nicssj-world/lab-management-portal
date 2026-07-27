# Grouped Calibration Plans Design

## Goal

Retain the familiar annual calibration-plan format while linking every planned item to real equipment records. Staff can create a grouped plan (for example, `BSC`) or a one-off plan for an individual instrument, without losing the existing PM/CAL result and certificate history.

## Existing plan to preserve

The legacy `calibration_plans` table and its UI are a flat annual budget table:

| Legacy field | Meaning in the new design |
| --- | --- |
| `group_name` | The visible plan-group heading, such as `1. ตู้ปลอดเชื้อ` |
| `name` | The plan title, such as `ตู้ปลอดเชื้อ (Biosafety Cabinet)` |
| `plan` | Calculated count of selected equipment; never manually entered for a linked group |
| `actual` | Calculated count of selected equipment with a completed result |
| `price` | Per-unit price when the price mode is per unit; blank for a lump-sum group |
| `budget` | Calculated per-unit total or entered lump-sum total |

The 2566 legacy records remain available as a read-only historical view. They are not converted automatically because they are not reliably linked to equipment IDs.

## Annual starting options

Selecting a fiscal year that has no group plans presents two explicit, non-destructive starting options:

1. **Start from the legacy template.** The old plan's group/title/price/budget structure is shown as editable draft rows for the selected year. Draft rows have no linked equipment and are excluded from all operational counts and financial totals until the user selects equipment and saves each group.
2. **Copy the previous fiscal year.** The user chooses a source fiscal year. The system copies that year's group headers, schedule, provider, price mode, and amounts into unsaved drafts for the selected year. It does not copy results, certificates, actual amounts, or member-plan IDs. The user reviews the equipment selection before saving, so removed or changed equipment cannot become an accidental active plan.

The year picker supports any valid Thai fiscal year, not only previous/current/next. Neither option mutates the source plan, the legacy records, or another year's saved plan. If the target year already has saved groups, the options remain available as “add from template” and “copy groups” and must identify title/schedule conflicts before creating duplicates.

## Chosen approach

Introduce a group header as a first-class record and keep the existing `equipment_pm_cal_plans` rows as the per-equipment schedule/result anchor.

1. A group stores the annual planning fields: fiscal year, group/title, PM or CAL, due month/date, provider, price mode, planned group amount, actual group amount, and audit/version fields.
2. Each selected instrument gets an `equipment_pm_cal_plans` row with the common schedule fields and a reference to that group. This preserves the current results, certificate attachment, due-state, and audit model.
3. A one-off individual plan remains an `equipment_pm_cal_plans` row with no group reference. It retains its own planned and actual cost.

This is preferred over using a text-only group label on individual rows because a group-level lump sum cannot otherwise be represented or edited safely.

## Data model

Create `equipment_pm_cal_plan_groups` with:

- `id`, `fiscal_year`, `group_name`, `plan_name`, `cal_type`, `calendar_month`, `due_date`, `provider`
- `price_mode`: `per_unit` or `lump_sum`
- `unit_price`: required only for `per_unit`
- `planned_amount`: derived as selected count × `unit_price` for `per_unit`; entered once for `lump_sum`
- `actual_amount`: one optional amount for the full group, never allocated to member instruments
- `record_status`, optimistic `version`, created/updated timestamps, and created/updated actor IDs

Add nullable `plan_group_id` to `equipment_pm_cal_plans`. An active member row inherits the group schedule. For a per-unit group it stores the unit `planned_cost`; for a lump-sum group it stores `null`, preventing the existing per-instrument report from multiplying the lump sum. Individual rows keep `plan_group_id = null` and their existing costs.

Enforce a member’s uniqueness through the existing active `(equipment_id, fiscal_year, calendar_month, cal_type)` rule. Group create/update validates the complete selection before any write and returns the conflicting equipment names/codes, rather than silently replacing another plan.

Deleting a group is a status cancellation: cancel the group and its active member rows only when no member has a result. If a result exists, editing must retain that member/history; the UI explains that the group cannot be deleted and offers a status change instead. Existing result rows and certificates are never deleted.

## User experience

The current “รายงานปัจจุบัน” becomes a plan workspace for a selected fiscal year:

- The fiscal-year selector accepts any valid year. An empty year offers `เริ่มจากแม่แบบเดิม` and `คัดลอกจากแผนปีก่อน`; both create reviewable drafts rather than immediately saving records.
- `สร้างแผนแบบกลุ่ม` opens a form with plan group, title, PM/CAL, schedule, provider, price mode, and an equipment picker sourced from the registry.
- The picker supports searching by code/name and shows selected count. Only instruments eligible for the chosen plan type are selectable; conflicting instruments are marked and explained.
- `ราคาต่อหน่วย` calculates the planned count and budget live. `ราคาเหมารวม` accepts one planned amount and one actual amount at the group level.
- `เพิ่มแผนรายเครื่องมือ` opens the existing per-equipment PM/CAL workflow; it is explicitly labelled as an exception and has no group header.
- The main table resembles the old plan: Group, Item, Planned, Completed, Price/Price mode, Planned budget, Actual cost, and a detail action. A group detail expands to show linked equipment and each member’s status.
- Legacy 2566 stays under its separate read-only tab.

For group plans, “completed” is a derived member count: PM counts completed PM results; CAL counts PASS results. A CAL FAIL remains visible in the member list and contributes to the group fail count, but not to completed.

## Reporting

The report API returns both group rows and individual exception rows for the requested fiscal year. Totals count every active equipment plan once. Financial totals add group planned/actual amounts once, plus costs from individual plans only; they never sum member rows for a lump-sum group.

The existing department/classification report remains available as a secondary breakdown. Group membership does not change equipment ownership, filtering, public equipment detail, or certificate access.

## Authorization, validation, and auditing

Read operations use the existing equipment `view` permission; create/update/cancel operations use `edit`. Route handlers continue to use `getPmCalActor` and service-role database access. Inputs are Zod-validated, Thai fiscal-year and due-date checks remain consistent with the current PM/CAL rules, and all mutations write audit-log events that include the group title or equipment code.

## Tests and migration

- SQL migration tests cover price-mode constraints, the group/member relationship, uniqueness conflicts, and non-destructive cancellation.
- Domain/report tests cover per-unit arithmetic, lump-sum counted once, member completion/failure totals, and individual-plan coexistence.
- API tests cover permissions, validation, conflict responses, and group create/edit/cancel behavior.
- UI tests cover both entry points, calculated/disabled price fields, equipment selection, and legacy read-only behavior.
- UI/API tests cover starting an empty year from the legacy template, copying a selected prior year without results or actual costs, arbitrary fiscal-year selection, and target-year conflict reporting.

The migration does not mutate `calibration_plans` or import guessed equipment mappings. It is additive and reversible by removing the new group feature only; production rollout requires applying the new Supabase migration before deploying the UI.

## Acceptance criteria

1. A user can create a BSC group for a fiscal year, choose multiple registered instruments, set shared schedule/provider, and save it.
2. The group’s planned count always equals selected equipment count.
3. Per-unit groups calculate planned amount from count × unit price; lump-sum groups show and total one planned/actual amount only.
4. Each selected member can record its own PM/CAL outcome and certificate through the existing workflow.
5. A user can add or edit an ungrouped individual plan without affecting any group.
6. Conflicting active schedules are rejected with the affected instruments identified.
7. The legacy 2566 table remains viewable, uneditable, and excluded from current-year operational totals.
8. A user can select any valid fiscal year and either start with unsaved legacy-template drafts or copy a chosen previous year's groups; neither action changes the source year or creates active budget totals before saving.
