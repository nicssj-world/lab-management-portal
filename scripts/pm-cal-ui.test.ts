import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const modal = readFileSync('components/equipment/EquipmentPmCalModal.tsx', 'utf8')
const publicPage = readFileSync('app/e/[id]/page.tsx', 'utf8')
const publicQuery = readFileSync('lib/queries/equipment-public.ts', 'utf8')
const registry = readFileSync('app/(protected)/staff/equipment/EquipmentClient.tsx', 'utf8')
const workspace = readFileSync('components/equipment/PmCalPlanWorkspace.tsx', 'utf8')
const groupModal = readFileSync('components/equipment/GroupedPmCalPlanModal.tsx', 'utf8')

assert.match(modal, /ปีงบประมาณ/)
assert.match(modal, /fiscalYear/)
assert.match(modal, /บันทึกผล PM\/CAL/)
assert.match(modal, /ประวัติการดำเนินงาน/)
assert.match(modal, /FAIL/)
assert.match(modal, /PASS/)
assert.match(modal, /NOT_PERFORMED/)
assert.match(modal, /resultPlan\.cal_type === 'CAL' && <>/)
assert.match(modal, /results\/\$\{created\.id\}\/certificate/)
assert.match(modal, /computePmCalPlanState/)
assert.match(modal, /expected_versions/)
assert.match(modal, /แนบ Certificate/)
assert.match(modal, /บันทึกผลแล้ว แต่อัปโหลด Certificate ไม่สำเร็จ/)
assert.doesNotMatch(modal, /JSON\.stringify\(\{ pm_cal_data: form \}\)/)
assert.match(publicPage, /getPublicPmCalStatus/)
assert.match(publicQuery, /nullsFirst: false/)
// Retired equipment must not show "เกินกำหนด" on the public QR page while the map shows it grey.
assert.match(publicQuery, /row\.status !== 'Inactive' && row\.needs_calibration/)
assert.match(registry, /\/api\/admin\/equipment\/pm-cal\/report/)
assert.match(registry, /รายงานปัจจุบัน/)
assert.match(registry, /Legacy/)
assert.match(registry, /Fail/)
assert.match(registry, /เกินกำหนด/)
assert.match(workspace, /เริ่มจากแม่แบบเดิม/)
assert.match(workspace, /คัดลอกจากแผนปีก่อน/)
assert.match(workspace, /ยกเลิกกลุ่ม/)
assert.match(workspace, /targetFiscalYear/)
// "ทำจริง" must count unlinked legacy-imported results too, not just plan_id-linked ones — grouping
// by plan_id alone silently drops them before computePmCalPlanState's own matching ever runs.
assert.match(workspace, /resultsByEquipment/)
assert.doesNotMatch(workspace, /if \(result\.plan_id\)/)
// Department / Classification filters on the main calibration plan table.
assert.match(workspace, /equipmentMatchesFilter/)
assert.match(workspace, /ทุกแผนก/)
assert.match(workspace, /ทุก Classification/)
// 30-row pagination spanning groups + ungrouped equipment, a "มีแผน ทำจริงยังไม่ครบ" FilterChips
// toggle, and clicking an equipment name opens the same EquipmentDetailModal as the registry.
assert.match(workspace, /const PAGE_SIZE = 30/)
assert.match(workspace, /completionFilter/)
assert.match(workspace, /มีแผน ทำจริงยังไม่ครบ/)
assert.match(workspace, /setDetailEquipmentId/)
assert.match(workspace, /EquipmentDetailModal equipmentId={detailEquipmentId}/)
// Page resets on fiscal-year change, and prev/next operate on the clamped safePage, not raw page,
// so a filter/year change that shrinks totalPages can't leave "ก่อนหน้า" needing several clicks.
assert.match(workspace, /useEffect\(\(\) => { setPage\(1\) }, \[fiscalYear\]\)/)
assert.match(workspace, /setPage\(Math\.max\(1, safePage - 1\)\)/)
assert.match(workspace, /setPage\(Math\.min\(totalPages, safePage \+ 1\)\)/)
assert.match(groupModal, /ราคาต่อหน่วย/)
assert.match(groupModal, /ราคาเหมารวม/)
assert.match(groupModal, /เลือกเครื่องมือ/)
assert.match(groupModal, /จำนวนแผน/)
// CAL conflicts are checked across the whole fiscal year (any month); PM only within selected months.
assert.match(groupModal, /form\.cal_type === 'PM' && !selectedMonths\.includes\(plan\.calendar_month\)/)
assert.match(groupModal, /conflictingMonth/)
// Multi-month creation (once-off PM/CAL happening more than once a year) is create-only.
assert.match(groupModal, /selectedMonths/)
assert.match(groupModal, /toggleMonth/)
assert.match(groupModal, /extra_months/)
assert.match(groupModal, /กรองตามแผนก/)
assert.match(groupModal, /กรองตาม classification/)
// Equipment picker list is paginated so it doesn't render every filtered item at once.
assert.match(groupModal, /EQUIPMENT_PICKER_PAGE_SIZE/)
assert.match(groupModal, /totalPages/)
// Retired/non-calibrated equipment must be excluded from NEW picks, but never hidden if already a
// selected group member (or editing a group could silently drop it on save).
assert.match(groupModal, /!selected\.has\(item\.id\) && \(!item\.needs_calibration \|\| item\.status !== 'Active'\)/)
assert.match(modal, /แผนกลุ่ม/)
// A completed plan (possibly via a legacy null-result) must still let the user record the real
// PASS/FAIL later as a new manual result — legacy rows themselves stay read-only.
assert.match(modal, /บันทึกผลเพิ่มเติม/)
assert.doesNotMatch(modal, /canEdit && state !== 'completed' && <button/)
// Fiscal year runs Oct-Sep; month grids/lists must walk FISCAL_MONTH_ORDER, not calendar Jan-Dec.
assert.match(modal, /FISCAL_MONTH_ORDER/)
assert.match(modal, /plansInFiscalOrder/)
assert.match(groupModal, /FISCAL_MONTH_ORDER/)
// Multi-month selection (Oct+Jan etc.) must pick the fiscally-first month as primary, not the
// numerically-lowest — otherwise selecting Oct+Jan would make Jan the primary month.
assert.match(groupModal, /\.sort\(compareByFiscalMonth\)/)
// History entries can be edited (PATCH) or hard-deleted; legacy_import rows are excluded (source === 'manual').
assert.match(modal, /openEditResult/)
assert.match(modal, /deleteResult/)
assert.match(modal, /result\.source === 'manual'/)
// Certificate upload supports drag & drop, not just click-to-browse (CLAUDE.md upload-control rule).
assert.match(modal, /certDragOver/)
assert.match(modal, /onDrop=\{event => \{/)

console.log('pm-cal UI contract passed')
