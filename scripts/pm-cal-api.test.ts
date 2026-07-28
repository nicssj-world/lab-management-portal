import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')
const overview = read('app/api/admin/equipment/[id]/pm-cal/route.ts')
const results = read('app/api/admin/equipment/[id]/pm-cal/results/route.ts')
const result = read('app/api/admin/equipment/[id]/pm-cal/results/[resultId]/route.ts')
const cert = read('app/api/admin/equipment/[id]/pm-cal/results/[resultId]/certificate/route.ts')
const report = read('app/api/admin/equipment/pm-cal/report/route.ts')
const migration = read('scripts/pm-cal-history.sql')
const genericEquipment = read('app/api/admin/equipment/[id]/route.ts')
const groups = read('app/api/admin/equipment/pm-cal/groups/route.ts')
const group = read('app/api/admin/equipment/pm-cal/groups/[groupId]/route.ts')
const drafts = read('app/api/admin/equipment/pm-cal/drafts/route.ts')
const pmCalServer = read('lib/equipment/pm-cal-server.ts')

for (const source of [overview, results, result, cert, report]) {
  assert.match(source, /getPmCalActor/)
  assert.match(source, /Forbidden|permission/i)
}
for (const source of [overview, results, result, cert]) assert.match(source, /await writePmCalAudit/)
assert.match(overview, /pmCalPlanReplaceSchema\.safeParse/)
assert.match(overview, /replace_equipment_pm_cal_plans/)
assert.match(overview, /p_expected_versions/)
assert.match(overview, /23505/)
assert.match(results, /pmCalResultCreateSchema\.safeParse/)
assert.match(results, /\.eq\('equipment_id', id\)/)
assert.match(results, /plan_group_id/)
assert.match(results, /ค่าใช้จ่ายจริง.*แผนกลุ่ม/)
assert.match(result, /equipment\.pm_cal\.result\.update/)
assert.match(result, /equipment_pm_cal_plans/)
assert.match(result, /plan\.cal_type !== parsed\.data\.cal_type/)
assert.match(result, /plan_group_id/)
// Hard delete of a PM/CAL result is intentional (user-confirmed) — legacy_import rows stay blocked.
assert.match(result, /export async function DELETE/)
assert.match(result, /equipment\.pm_cal\.result\.delete/)
assert.match(result, /existing\.source === 'legacy_import'/)
assert.match(cert, /equipment\/\$\{id\}\/pm-cal\/\$\{resultId\}\//)
assert.match(cert, /HeadObjectCommand/)
assert.match(cert, /ContentLength/)
assert.match(cert, /ContentType/)
assert.match(cert, /50 \* 1024 \* 1024/)
assert.match(cert, /source/)
assert.match(cert, /legacy_import/)
assert.match(cert, /req\.json\(\)\.catch\(\(\) => null\)/)
assert.doesNotMatch(cert, /DeleteObjectCommand[\s\S]*oldKey/)
assert.match(report, /buildPmCalReport/)
assert.match(report, /fiscalYear/)
assert.match(report, /department/)
assert.match(report, /classification/)
assert.match(genericEquipment, /delete body\.pm_cal_data/)
for (const source of [groups, group, drafts]) assert.match(source, /getPmCalActor/)
// The results fetch for this workspace must include unlinked legacy-imported results (equipment_id
// scoped), not just plan_id-linked ones — see pm-cal-domain.ts / EquipmentPmCalModal history notes.
assert.match(groups, /\.in\('equipment_id', equipmentIds\)/)
// The main equipment fetch stays filtered (needs_calibration/Active) — fetching all ~500 rows
// unfiltered made this route slow/unstable. Equipment referenced by a stale plan (retired since) is
// backfilled by a small targeted .in() query instead, so it still gets a real name, not a raw UUID.
assert.match(groups, /staleEquipmentIds/)
assert.match(groups, /\.filter\(id => !equipmentById\.has\(id\)\)/)
assert.match(groups, /pmCalPlanGroupReplaceSchema\.safeParse/)
assert.match(groups, /replace_equipment_pm_cal_plan_group/)
assert.match(groups, /findPmCalGroupConflicts/)
assert.match(group, /findPmCalGroupConflicts/)
assert.match(group, /cancel_equipment_pm_cal_plan_group/)
assert.match(group, /409/)
assert.match(drafts, /legacy_template/)
assert.match(drafts, /sourceFiscalYear/)
// Dashboard "มีการสอบเทียบ" stat and PDF export must not rely solely on the stale pm_cal_data field.
const lastCalDates = read('app/api/admin/equipment/pm-cal/last-cal-dates/route.ts')
assert.match(lastCalDates, /getPmCalActor/)
assert.match(lastCalDates, /eq\('cal_type', 'CAL'\)/)
const equipmentClient = read('app/(protected)/staff/equipment/EquipmentClient.tsx')
assert.match(equipmentClient, /last-cal-dates/)
assert.match(equipmentClient, /lastCalDates\[e\.id\]/)
assert.match(report, /equipment_pm_cal_plan_groups/)
// Legacy-imported (unlinked) results must reach computePmCalPlanState — scoped by equipment_id,
// not filtered out by plan_id, or completed legacy calibrations report as overdue.
assert.doesNotMatch(report, /\.not\('plan_id', 'is', null\)/)
assert.match(report, /equipmentIds\.has\(result\.equipment_id\)/)

// CAL is once-per-year per equipment, so a conflict must be checked across the whole fiscal year
// regardless of month; PM recurs monthly by design, so only the same month counts as a conflict.
assert.match(pmCalServer, /input\.calType === 'PM'\) query = query\.eq\('calendar_month'/)
assert.doesNotMatch(pmCalServer, /\.eq\('calendar_month', input\.calendarMonth\)\.eq\('cal_type'/)
// extra_months lets one create action spin off sibling groups in other months (e.g. quarterly CAL);
// conflicts for the whole batch are checked up front, before any of the months are written.
assert.match(groups, /extra_months/)
assert.match(groups, /lastDayOfFiscalMonth/)
// Creating a group must keep the user's own due_date for the primary month — only extra_months
// siblings (no user-provided date) fall back to the computed month-end.
assert.match(groups, /calendarMonth === group\.calendar_month \? group\.due_date : lastDayOfFiscalMonth/)
const validation = read('lib/equipment/pm-cal-validation.ts')
assert.match(validation, /extra_months: z\.array/)

assert.match(migration, /create or replace function public\.replace_equipment_pm_cal_plans/i)
assert.match(migration, /security invoker/i)
assert.match(migration, /revoke all on function public\.replace_equipment_pm_cal_plans/i)

console.log('pm-cal API contract passed')
