// กันไม่ให้ UI ของแผนผังเครื่องมือหลุดกลับไปเป็นสไตล์เดิม และกันไม่ให้ช่องโหว่ตำแหน่งบนแผนที่กลับมา

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { EQUIPMENT_DEPARTMENTS, mergeEquipmentDepartments } from '../lib/equipment/departments'

const read = (path: string) => readFileSync(path, 'utf8')

const canvas = read('components/equipment-map/EquipmentMapCanvas.tsx')
const client = read('components/equipment-map/EquipmentMapClient.tsx')
const styles = read('components/equipment-map/EquipmentMapStyles.tsx')
const walkGroups = read('lib/equipment-map/walk-groups.ts')
const dialog = read('components/equipment-map/EquipmentPinDialog.tsx')
const areaPanel = read('components/equipment-map/AreaPanel.tsx')
const placementPanel = read('components/equipment-map/PlacementPanel.tsx')
const equipmentRegistry = read('app/(protected)/staff/equipment/EquipmentClient.tsx')
const equipmentDepartments = read('lib/equipment/departments.ts')
const equipmentDetailModalPath = 'components/equipment/EquipmentDetailModal.tsx'
const equipmentPmCalModalPath = 'components/equipment/EquipmentPmCalModal.tsx'
const placementFiltersPath = 'components/equipment-map/PlacementFilters.tsx'
assert.ok(existsSync(placementFiltersPath), 'the placement filter toolbar component must exist')
const placementFilters = read(placementFiltersPath)
const equipmentMapServer = read('lib/equipment-map/server.ts')
const surveyBar = read('components/equipment-map/SurveyRoundBar.tsx')
const sidebar = read('components/layout/StaffSidebar.tsx')
const positionRoute = read('app/api/admin/equipment/[id]/position/route.ts')
const equipmentMapPage = read('app/(protected)/staff/equipment/map/page.tsx')
const equipmentMapModuleSql = read('scripts/equipment-map-module.sql')
const patchRoute = read('app/api/admin/equipment/[id]/route.ts')
const postRoute = read('app/api/admin/equipment/route.ts')
const importRoute = read('app/api/admin/equipment/import/route.ts')
const exportRoute = read('app/api/admin/equipment/export/route.ts')
const areaAssignment = read('lib/equipment-map/area-assignment.ts')
const manifest = read('lib/equipment-map/manifest.ts')

assert.ok(EQUIPMENT_DEPARTMENTS.includes('สำนักงานกลุ่มงานเทคนิคการแพทย์'), 'the canonical equipment departments must include the medical technology group office')
assert.deepEqual(
  mergeEquipmentDepartments(['แผนกจากข้อมูลจริง', 'สำนักงานกลุ่มงานเทคนิคการแพทย์', '']),
  mergeEquipmentDepartments(['แผนกจากข้อมูลจริง']),
  'department merging must retain live values while removing blanks and duplicates',
)
assert.match(equipmentDepartments, /export const EQUIPMENT_DEPARTMENTS/, 'equipment department defaults must have one canonical source')
assert.match(equipmentRegistry, /mergeEquipmentDepartments/, 'the equipment registry must merge departments from the canonical source')
assert.match(placementFilters, /mergeEquipmentDepartments\(dynamicOptions\.departments\)/, 'the map placement filter must include canonical departments as well as departments found in unplaced equipment')
assert.match(equipmentRegistry, /setAvailableDepartments\(parsed\.departments\)/, 'registry department options must refresh after an import or external change')

// ── export/import ต้องรักษาพื้นที่ด้วย stable code และใช้กติกา LAB Code เหมือนหน้าเพิ่ม/แก้ไข ──
assert.match(exportRoute, /'Area Code', 'ห้อง\/โซน'/, 'equipment export must include a stable area code next to the display name')
assert.match(exportRoute, /eq\.area_code \?\? ''/, 'equipment export rows must carry their stable area code')
assert.match(importRoute, /'area code': 'area_code'/, 'equipment import must recognize the stable Area Code column')
assert.match(importRoute, /'ห้อง\/โซน': 'area_name'/, 'equipment import must remain backward-compatible with exported room names')
assert.match(importRoute, /resolveImportArea\(/, 'equipment import must validate and resolve imported areas')
assert.match(importRoute, /if \(labInfo\.department\) record\.department = labInfo\.department/, 'LAB Code must override a conflicting spreadsheet department during import')
assert.match(importRoute, /record\.area_code !== existingAreaCode[\s\S]*cleaned\.map_x = null[\s\S]*cleaned\.map_y = null/, 'changing an imported area must clear stale map coordinates without clearing a pin when the area is unchanged')

// ── dropdown ห้อง/โซนต้องใช้ taxonomy กลุ่มงาน ไม่เสนอกรอบ OUTLAB ที่ครอบคลังเลือด ──
assert.match(equipmentRegistry, /EQUIPMENT_WORK_GROUPS/, 'the registry area dropdown must render the canonical work-group taxonomy')
assert.match(equipmentRegistry, /work-group:\$\{group\.code\}/, 'the registry must offer a whole-work-group filter with a namespaced selection value')
assert.match(equipmentRegistry, /isEquipmentAreaSelectable/, 'the registry area dropdown must exclude geometric containers that span multiple work groups')

// ── เลือก “ทั้งงาน” ต้องไฮไลต์ทุกพื้นที่ของกลุ่มงานบนผัง ไม่ใช่พยายามไฮไลต์รหัส synthetic ──
assert.match(client, /selectedWorkGroupAreaCodes/, 'the map client must derive all area codes for a selected whole-work-group option')
assert.match(client, /highlightedAreaCodes=\{selectedWorkGroupAreaCodes\}/, 'the map canvas must receive every area in the selected work group for highlighting')
assert.match(canvas, /highlightedAreaCodes: readonly string\[\]/, 'the canvas must accept multiple highlighted area codes')
assert.match(canvas, /data-highlighted=\{isHighlighted \|\| undefined\}/, 'each matching room or zone must receive the shared yellow-highlight state')

// ── กันบั๊กแผ่นดำสนิท (เคยเกิดกับแผนที่ความปลอดภัย): ต้องห่อด้วย .lab-map-shell และ render LabMapStyles ──
assert.match(client, /import { LabMapStyles }/, 'EquipmentMapClient must import the shared lab-map token component')
assert.match(client, /<LabMapStyles \/>/, 'EquipmentMapClient must render <LabMapStyles /> so --map-* tokens resolve')
assert.match(client, /className="lab-map-shell equipment-map-shell"/, 'the shell must carry both class names so lab-map tokens cascade')
assert.match(client, /<EquipmentMapStyles \/>/, 'EquipmentMapClient must render its own EquipmentMapStyles addendum')

// ── onCoordinateSelect ต้อง clamp ตาม viewBox ที่ parse มา ไม่ใช่ผูกกับ 1477/892 ตรง ๆ (กับดักเดิมของ LabMapCanvas) ──
assert.match(canvas, /viewBox\.split\(' '\)\.map\(Number\)/, 'the canvas must parse its own viewBox rather than hardcoding map dimensions')
assert.doesNotMatch(canvas, /Math\.min\(1477/, 'must not hardcode the lab-map viewBox width like the original LabMapCanvas did')

// ── ห้องและโซนทั้งหมดต้องใช้สีพื้นเดียวกัน ไม่สื่อความหมายต่างกันด้วยชนิดพื้นที่ ──
assert.match(canvas, /'--space-fill': 'var\(--map-controlled\)'/, 'all defined rooms and zones, including rooms named โถง 1–3, must share one fill colour')
assert.doesNotMatch(canvas, /area\.fillTone ===|area\.kind === 'zone'\) \?/, 'area fill must not vary by room/zone type')
assert.match(styles, /--map-floor: #edf2f3/, 'unassigned corridor floor must be light gray')
assert.doesNotMatch(styles, /--equipment-corridor-fill/, 'rooms named โถง must not inherit the unassigned corridor colour')
assert.doesNotMatch(
  styles,
  /\.equipment-map-shell \.lab-map-workspace \{[^}]*height: clamp\(/,
  'the placement report must not be trapped inside a viewport-bound nested scroller',
)
assert.match(
  styles,
  /\.equipment-map-shell \.lab-map-workspace \{[^}]*align-items: start;[^}]*height: auto;[^}]*overflow: visible;/,
  'the desktop workspace must grow with the five report cards so the page itself can reach the final card',
)
assert.match(canvas, /preserveAspectRatio="xMidYMin meet"/, 'a taller report must keep the map aligned to the top of its SVG frame')

// ── ห้ามสื่อสถานะด้วยสีอย่างเดียว: ทุกหมุดต้องมีสัญลักษณ์ตัวอักษรกำกับสถานะนอกจากสี ──
for (const glyph of ['✕', '?', '!', '◐', '✓']) {
  assert.ok(canvas.includes(glyph), `pin glyph set must include ${glyph}`)
}
assert.match(canvas, /getEquipmentPinSymbol\(pin\.classification, pin\.name\)/, 'a pin shape must be selected from its persisted classification')
assert.match(canvas, /function PinShape\(/, 'the map must render equipment-specific SVG pin shapes')
assert.match(canvas, /function labelPositionAwayFromPins\(/, 'area labels must move within their room when a placed icon would cover the text')
assert.match(canvas, /labelPositionAwayFromPins\(area, pins\)/, 'label rendering must use the icon-avoidance position')
assert.match(canvas, /equipment-pin-status-badge/, 'the PM\/CAL or survey status must render as an overlay separate from the equipment shape')
assert.match(canvas, /equipment-pin-refrigerator/, 'the canvas must support a refrigerator marker')
assert.match(canvas, /equipment-pin-centrifuge/, 'the canvas must support a centrifuge marker')
assert.match(canvas, /equipment-pin-microscope/, 'the canvas must support a microscope marker')
assert.match(canvas, /equipment-pin-microscope[\s\S]*equipment-pin-hit-area/, 'the narrow microscope silhouette must have an enlarged transparent hit area')
assert.match(canvas, /equipment-pin-bsc/, 'the canvas must support a BSC marker')
assert.match(styles, /\.equipment-pin-body \{ fill: #fff;/, 'equipment silhouettes must use the white body from the approved mockup, not a solid dark label')
assert.match(styles, /\.equipment-pin-body \{[^}]*stroke: var\(--map-blue\);/, 'equipment silhouettes must use the approved blue outline')
assert.match(canvas, /equipment-pin-centrifuge[\s\S]*equipment-pin-rotor-dot/, 'centrifuge markers must visibly show their rotor rather than only a text code')
assert.match(canvas, /equipment-pin-bsc[\s\S]*M 9 18 H 39 M 9 24 H 39 M 9 30 H 39/, 'BSC markers must use horizontal grille lines like the approved mockup')
assert.match(canvas, /className="equipment-pin-scale"[\s\S]*scale\(0\.7\)/, 'all equipment symbol bodies and their status badges must render at the reduced 70% scale')
assert.match(client, /equipment-map-symbol-legend/, 'the map must show a compact legend for equipment symbol shapes')
assert.match(client, /function EquipmentSymbolLegendMark\(/, 'the legend must render the same distinct equipment silhouettes as the map')
assert.match(client, /equipment-symbol-preview--microscope/, 'the legend must show a true microscope silhouette instead of a clipped text label')
for (const label of ['ตู้เย็น', 'เครื่องปั่นเหวี่ยง', 'กล้องจุลทรรศน์', 'ตู้ชีวนิรภัย']) {
  assert.ok(client.includes(label), `the map symbol legend must label ${label}`)
}

// ── สถานะสำรวจ (เขียว/แดง) ต้องเป็นคนละช่องทางกับสถานะ due (ตามที่ผู้ใช้ระบุ: ติ๊กสำรวจแล้ว/ยังไม่สำรวจ แยกจากสถานะ PM/CAL) ──
assert.match(canvas, /data-surveyed=/, 'pins must carry a data-surveyed attribute independent of the due-state glyph')
assert.match(canvas, /data-due=/, 'pins must carry a data-due attribute')

// ── กรอกลุ่มเครื่องมือใน sidebar: ลูกทั้งสองถือ resource เดียวกัน ไม่ใช่แม่ ──
const equipmentGroupMatch = sidebar.match(/href: '\/staff\/equipment',[\s\S]{0,800}?\]\s*\},/)
assert.ok(equipmentGroupMatch, 'sidebar must define an equipment group with children')
const equipmentGroup = equipmentGroupMatch![0]
assert.doesNotMatch(
  equipmentGroup.split('children:')[0],
  /resource:/,
  'the equipment group parent must not carry a resource — isEntryVisible checks the parent first and would hide all children',
)
assert.match(equipmentGroup, /href: '\/staff\/equipment',(?:(?!href:)[\s\S])*resource: 'ทะเบียนเครื่องมือ'/, 'registry child must carry the resource')
assert.match(equipmentGroup, /href: '\/staff\/equipment\/map',(?:(?!href:)[\s\S])*resource: 'ทะเบียนเครื่องมือ'/, 'map child must carry the resource')

// ── ช่องโหว่ที่ต้องปิด: PATCH/POST เดิมของทะเบียนต้องไม่ยอมให้ตำแหน่งหลุดผ่าน body ที่ไม่มี whitelist ──
for (const field of ['map_x', 'map_y', 'map_rotation', 'area_code', 'position_set_by', 'position_set_at']) {
  assert.match(patchRoute, new RegExp(`delete body\\.${field}`), `PATCH /api/admin/equipment/[id] must strip ${field} from the request body`)
  assert.match(postRoute, new RegExp(`delete body\\.${field}`), `POST /api/admin/equipment must strip ${field} from the request body`)
}
assert.match(postRoute, /resolveEquipmentAreaAssignment\(requestedAreaCode, actor\.id\)/, 'create must validate and persist the selected area in the same equipment insert')
assert.match(patchRoute, /resolveEquipmentAreaAssignment\(requestedAreaCode, actor\.id\)/, 'edit must validate and persist the selected area in the same equipment update')
assert.match(areaAssignment, /map_x: null[\s\S]*map_y: null/, 'changing an area through the registry must clear coordinates that belonged to the previous room')
assert.match(equipmentRegistry, /const payload = areaChanged \|\| !isEdit/, 'the registry must send areaCode only for a new item or an actual area change')
assert.doesNotMatch(equipmentRegistry, /fetch\(`\/api\/admin\/equipment\/\$\{json\.id\}\/position`/, 'the registry save must not leave a partially-saved second position request')

// ── ตำแหน่งบนแผนที่แก้ได้เฉพาะทาง /position เท่านั้น และต้อง validate ว่าอยู่ในขอบเขตพื้นที่จริง ──
assert.match(positionRoute, /getPermissionsWithEquipmentOverride/, 'position route must reuse the same permission gate as the rest of the module')
assert.match(positionRoute, /!== 'edit'/, 'position route must require edit-level permission, not just view')
assert.match(positionRoute, /areaDefByCode\.get\(areaCode\)\?\.rect/, 'position route must validate the point against the area\'s actual geometry')
assert.match(positionRoute, /position_set_by/, 'position route must record who set the position for audit purposes')
assert.match(positionRoute, /const rotation: number \| null = body\.rotation \?\? null/, 'position route must accept an explicit map rotation')
assert.match(positionRoute, /rotation !== null && !\[0, 90, 180, 270\]\.includes\(rotation\)/, 'position route must constrain map rotation to quarter turns')
assert.match(equipmentMapModuleSql, /map_rotation smallint not null default 0/, 'the equipment-map schema must persist orientation with a default of 0 degrees')

// ── พิกัดต้องมาจากไฟล์ต้นฉบับ .pptx ผ่านตัวแปลงหน่วยเดียว ไม่ใช่ตัวเลข SVG ที่พิมพ์มือทีละตัว ──
assert.match(manifest, /rectIn\(/, 'areas must be authored in the source drawing\'s inch coordinates via rectIn()')
assert.match(manifest, /ORIGIN_X_IN|ORIGIN_Y_IN/, 'the inch → SVG transform must be declared once')
assert.doesNotMatch(
  manifest,
  /^\s*import[^\n]*['"]@\/lib\/lab-map/m,
  'the equipment map must not borrow lab-map geometry — that was the bug that put every room in the wrong place',
)

// ── modal overlay ต้องไม่มี onClick ปิดที่ backdrop (กติกาโครงการ: ปิดด้วยปุ่ม X เท่านั้น) ──
assert.doesNotMatch(dialog, /inset: 0,[\s\S]{0,80}onClick={close}/, 'the pin dialog backdrop must not close on click — X button only')
assert.match(dialog, /fetch\(`\/api\/admin\/equipment\/\$\{pin\.id\}\/photo`/, 'the pin dialog must request the selected equipment photo on demand')
assert.match(dialog, /<img\s+src={photoUrl}/, 'the pin dialog must display the signed equipment photo when one exists')

// ── ต้องใช้คอมโพเนนต์ของระบบ ไม่ใช่ปุ่ม/badge มือ ──
for (const required of ['@/components/ui/Button', '@/components/ui/Badge']) {
  assert.ok(dialog.includes(required), `EquipmentPinDialog must import ${required}`)
}
assert.ok(areaPanel.includes('@/components/ui/Button'), 'AreaPanel must import Button')
assert.match(client, /<AreaPanel\s+key={selectedArea\.code}/, 'switching rooms must remount AreaPanel so the previous draft name cannot follow the selection')
assert.ok(placementPanel.includes('@/components/ui/EmptyState'), 'PlacementPanel must show EmptyState when nothing is unplaced')
assert.match(placementPanel, /กลับไปแผนผังเครื่องมือ/, 'PlacementPanel must provide an explicit way back to the equipment map')
assert.match(placementPanel, /pageItems\.map/, 'PlacementPanel must render only the current page of unplaced equipment')
assert.doesNotMatch(placementPanel, /unplaced\.map/, 'PlacementPanel must not render every unplaced item at once')
assert.match(placementPanel, /value=\{areaCodeByItem\[item\.id\] \?\? item\.areaCode \?\? ''\}/, 'the area selector must be controlled so its displayed choice follows refreshed map data')
assert.doesNotMatch(placementPanel, /defaultValue=\{item\.areaCode/, 'the area selector must not retain a stale default choice after an assignment')
assert.match(placementPanel, /groupEquipmentWalkAreas\(selectableAreas\.map/, 'the placement selector must use the same work-area taxonomy as the main map picker')
assert.match(placementPanel, /<optgroup key=\{group\.code\} label=\{group\.nameTh\}>/, 'the placement selector must group assignable areas by work group')
assert.match(placementPanel, /<optgroup label="พื้นที่อื่น ๆ">/, 'standalone map areas must remain available under a clear separate group')
assert.match(placementPanel, /ก่อนหน้า/, 'PlacementPanel must provide previous-page navigation')
assert.match(placementPanel, /ถัดไป/, 'PlacementPanel must provide next-page navigation')
assert.match(placementFilters, /aria-pressed={calibrationOnly}/, 'the calibration control must expose its toggle state')
assert.match(placementFilters, /ต้องการสอบเทียบ/, 'the placement toolbar must include the calibration filter')
assert.match(placementFilters, /ทุกแผนก/, 'the placement toolbar must include the department filter')
assert.match(placementFilters, /ทุก Classification/, 'the placement toolbar must include the Classification filter')
assert.doesNotMatch(placementPanel, /equipment-placement-filters|filterPlacementItems|placementFilterOptions/, 'filters must not remain duplicated inside the report panel')
assert.match(client, /const \[placementDepartment, setPlacementDepartment\] = useState\(''\)/, 'the map client must own the placement department filter')
assert.match(client, /const \[placementClassification, setPlacementClassification\] = useState\(''\)/, 'the map client must own the placement Classification filter')
assert.match(client, /const \[placementCalibrationOnly, setPlacementCalibrationOnly\] = useState\(false\)/, 'the map client must own the placement calibration toggle')
assert.match(client, /filterPlacementItems\(\s*map\.unplaced,\s*placementDepartment,\s*placementClassification,\s*placementCalibrationOnly/, 'the unplaced report must combine all three filters')
assert.match(client, /const \[optimisticAreaCodes, setOptimisticAreaCodes\] = useState/, 'the map must retain an area choice while the refreshed server snapshot is pending')
assert.match(client, /setFilters\(\{ area: areaCode \}\)/, 'choosing an area from the placement report must select the same area on the main map')
assert.match(client, /key={placementFilterRevision}/, 'changing any placement filter must reset report pagination to page 1')
assert.match(client, /showPlacement && canEdit \? \(\s*<PlacementFilters/, 'placement filters must render only while an editor opens the unplaced report')
assert.match(client, /window\.addEventListener\('focus', refreshAfterExternalChange\)/, 'the map must refresh when returning from registry changes in another tab')
assert.match(equipmentRegistry, /Promise\.all\(\[loadEquipmentList\(\), loadEquipmentAreas\(\)\]\)/, 'the registry must refresh equipment and renamed areas when its tab regains focus')
assert.doesNotMatch(client, /showRegistryLink=\{false\}/, 'whole-work-group panels must retain the link to the filtered equipment registry')
assert.ok(client.indexOf('<PlacementFilters') < client.indexOf('<div className="lab-map-workspace">'), 'placement filters must render above the map workspace')
assert.match(styles, /\.equipment-placement-toolbar \{/, 'the moved placement filters must have a dedicated horizontal toolbar')
assert.match(placementPanel, /className="equipment-area-panel equipment-placement-panel"/, 'the placement report must have a dedicated layout hook')
assert.match(placementPanel, /className="equipment-placement-list"/, 'equipment cards must remain grouped for report spacing')
assert.match(styles, /\.equipment-placement-panel \{[^}]*overflow: visible;/, 'the desktop placement panel must not clip the final card')
assert.match(styles, /\.equipment-placement-list \{[^}]*overflow: visible;[^}]*padding-bottom: 32px;/, 'the card list must participate in natural page scrolling with bottom clearance')
assert.ok(surveyBar.includes('@/components/ui/Button'), 'SurveyRoundBar must import Button')

// ── กดชื่อเครื่องมือในรายงานแล้วต้องเปิดรายละเอียดตัวเดียวกับทะเบียน และโหลดรูปแบบ on demand ──
assert.ok(existsSync(equipmentDetailModalPath), 'the shared equipment detail modal must exist')
const equipmentDetailModal = read(equipmentDetailModalPath)
assert.match(equipmentRegistry, /import { EquipmentDetailModal } from '@\/components\/equipment\/EquipmentDetailModal'/, 'the registry must use the shared detail modal')
assert.match(placementPanel, /onViewDetails\(item\.id\)/, 'clicking an unplaced equipment name must request its details')
assert.match(placementPanel, /className="equipment-placement-name"/, 'the clickable equipment name must have a dedicated accessible control style')
assert.match(client, /<EquipmentDetailModal\s+key={detailEquipmentId}\s+equipmentId={detailEquipmentId}/, 'the map must open the shared modal and fetch the selected equipment on demand')
assert.match(equipmentDetailModal, /api\/admin\/equipment\/\$\{equipmentId\}/, 'the shared modal must load a full equipment record by id')
assert.match(equipmentDetailModal, /api\/admin\/equipment\/\$\{resolvedItem\.id\}\/photo/, 'the shared modal must load the signed equipment photo')

// ── ดู PM/CAL จากหมุดต้องเปิดหน้าต่างจัดการในหน้าแผนผัง ไม่เปิดแท็บทะเบียนใหม่ ──
assert.ok(existsSync(equipmentPmCalModalPath), 'the shared PM/CAL management modal must exist')
const equipmentPmCalModal = read(equipmentPmCalModalPath)
assert.match(equipmentRegistry, /import { EquipmentPmCalModal } from '@\/components\/equipment\/EquipmentPmCalModal'/, 'the registry must use the shared PM/CAL modal')
assert.match(dialog, /onOpenPmCal: \(id: string\) => void/, 'the pin dialog must delegate PM/CAL opening to its parent page')
assert.match(dialog, /onClick=\{\(\) => onOpenPmCal\(pin\.id\)\}/, 'the pin PM/CAL button must open the in-page modal')
assert.doesNotMatch(dialog, /window\.open\(`\/staff\/equipment\?open=/, 'the pin PM/CAL button must not navigate to the registry in another tab')
assert.match(client, /<EquipmentPmCalModal\s+item=\{pmCalItem\}/, 'the map must render the PM/CAL management modal in the current page')
assert.match(equipmentPmCalModal, /\/pm-cal\?fiscalYear=/, 'the shared PM/CAL modal must load fiscal-year plans in place')
assert.match(equipmentPmCalModal, /method: 'PUT'/, 'the shared PM/CAL modal must save plans through the dedicated endpoint')

// ── ผู้แก้ไขต้องเอาเครื่องมือออกจากแผนผังได้ โดยไม่ลบทะเบียน และใช้ปุ่มสี danger ที่ต่างจากปุ่มจัดการทั่วไป ──
assert.match(dialog, /onRemoveFromMap: \(\) => void/, 'the pin dialog must expose a remove-from-map action')
assert.match(dialog, /variant="danger"[\s\S]{0,180}เอาออกจากแผนผัง/, 'the remove-from-map action must be visually distinct from ordinary controls')
assert.match(dialog, /onClick=\{onRemoveFromMap\}/, 'the remove-from-map button must call the parent action')
assert.match(dialog, /marginLeft: 'auto'[\s\S]{0,220}variant="danger"[\s\S]{0,180}เอาออกจากแผนผัง/, 'the remove-from-map action must stay aligned to the right edge of the action row')
assert.match(client, /callApi\(`\/api\/admin\/equipment\/\$\{id\}\/position`, 'PATCH', \{ areaCode: null, x: null, y: null \}\)/, 'removing from the map must clear both the assigned area and pin coordinates through the position API')

// ── ย้ายห้อง/โซนจาก popup หมุดได้โดยตรง โดยเลือกได้เฉพาะพื้นที่ที่เปิดใช้งาน ──
assert.match(dialog, /areas: readonly EquipmentAreaDTO\[\]/, 'the pin dialog must receive the available map areas')
assert.match(dialog, /onMoveToArea: \(areaCode: string\) => void/, 'the pin dialog must expose direct area reassignment')
assert.match(dialog, /areas\.filter\(\(area\) => area\.isActive && isEquipmentAreaSelectable\(area\.code\)\)/, 'the direct area picker must exclude inactive areas and geometric containers')
assert.match(dialog, /onClick=\{\(\) => onMoveToArea\(selectedAreaCode\)\}/, 'the direct area picker must apply the selected area')
assert.match(client, /callApi\(`\/api\/admin\/equipment\/\$\{id\}\/position`, 'PATCH', \{ areaCode, x: null, y: null \}\)/, 'direct area reassignment must clear the old pin coordinates through the position API')

// ── ลากหมุดได้เฉพาะในพื้นที่ที่เครื่องมือนั้นถูกกำหนดไว้: ห้ามย้ายข้ามโซนโดยการลาก ──
assert.match(canvas, /onMovePin\?: \(input: \{ id: string; areaCode: string; x: number; y: number \}\) => void/, 'the canvas must expose a persisted pin-drag callback')
assert.match(canvas, /areas\.find\(\(area\) => area\.code === draggedPin\.areaCode\)/, 'a dragged pin must be constrained against its own assigned area')
assert.match(canvas, /inArea\(assignedArea, point\)/, 'the canvas must reject a drag preview outside the assigned area geometry')
assert.match(canvas, /onPointerDown=\{\(event\) => startPinDrag\(event, pin\)\}/, 'equipment pins must start a direct pointer drag')
assert.match(canvas, /onMovePin\?\.\(\{ id: draggedPin\.id, areaCode: draggedPin\.areaCode, x: Math\.round\(dragPreview\.x\), y: Math\.round\(dragPreview\.y\) \}\)/, 'dropping a pin must save coordinates while preserving its assigned area')
assert.match(canvas, /rotate\(\$\{pinRotation\} \$\{pinX\} \$\{pinY\}\)/, 'the rendered equipment symbol must rotate around its own position')
assert.match(client, /function handleMovePin\(input: \{ id: string; areaCode: string; x: number; y: number \}\)/, 'the map page must persist a direct pin drag')
assert.match(client, /callApi\(`\/api\/admin\/equipment\/\$\{input\.id\}\/position`, 'PATCH', \{ areaCode: input\.areaCode, x: input\.x, y: input\.y \}\)/, 'direct pin drag must save through the existing validated position API')
assert.match(client, /const \[optimisticPinPositions, setOptimisticPinPositions\] = useState/, 'the map client must retain a dropped pin at its optimistic position while refresh is pending')
assert.match(client, /setOptimisticPinPositions\(\(current\) => \(\{ \.\.\.current, \[input\.id\]: \{ \.\.\.current\[input\.id\], x: input\.x, y: input\.y \} \}\)\)/, 'dropping a pin must update its displayed position before the network request returns')
assert.match(client, /pins=\{mapPins\}/, 'the canvas must receive optimistic pin coordinates instead of the stale server snapshot')
assert.match(client, /if \(pin && pin\.x === position\.x && pin\.y === position\.y/, 'optimistic coordinates must clear only after the refreshed server data confirms them')
assert.match(client, /onError\?\.\(\)/, 'a failed position request must be able to revert its optimistic coordinate')
assert.match(dialog, /onRotate: \(rotation: number\) => void/, 'the pin dialog must expose a quarter-turn control')
assert.match(dialog, /หมุน 90°/, 'the pin dialog must give editors a clear rotate action')
assert.match(client, /function handleRotatePin\(rotation: number\)/, 'the map page must persist icon rotation')

// ── Equipment-map permissions follow the main registry role; read-only pins must still open their details ──
assert.match(equipmentMapPage, /select\('role'\)/, 'the map page must determine map access from the main role')
assert.doesNotMatch(equipmentMapPage, /doc_role/, 'the document workflow role must not alter equipment-map access')
assert.match(positionRoute, /select\('id, role'\)/, 'the position API must determine access from the main role')
assert.doesNotMatch(positionRoute, /doc_role/, 'the position API must not use the document workflow role')
assert.match(client, /actions=\{canEdit \? \(/, 'only equipment-map editors may open the unplaced-equipment placement workflow')
assert.match(client, /showPlacement && canEdit \? \(/, 'the placement workflow must stay hidden for read-only users')
assert.match(canvas, /if \(!onMovePin \|\| pin\.x == null \|\| pin\.y == null\) \{\s*event\.stopPropagation\(\)/, 'read-only pin presses must not bubble to canvas panning and swallow the pin click')

// ── Mobile gestures ──
// Areas cover almost the whole SVG, so panning must begin from an area; pins keep their own long-press drag.
const equipmentMapStartPan = canvas.match(/function startPan[\s\S]*?\n  function movePan/)?.[0] ?? ''
assert.doesNotMatch(equipmentMapStartPan, /target\.closest/, 'area taps must be eligible to begin a map pan')
assert.match(canvas, /const activePointers = useRef\(new Map<number, \{ clientX: number; clientY: number; svgX: number; svgY: number \}>\(\)\)/, 'the map must track simultaneous pointers in screen and SVG coordinates')
assert.match(canvas, /activePointers\.current\.size >= 2/, 'two-finger input must enter a pinch gesture')
assert.match(canvas, /initialDistance/, 'pinch zoom must calculate scale from the initial finger distance')
assert.match(canvas, /didGesture/, 'a completed pan or pinch must not also select an area on click')
assert.match(canvas, /function resolveSvgViewportPoint\(/, 'dragging must convert screen coordinates through the SVG viewport matrix')
assert.doesNotMatch(canvas, /const factor = 1 \/ view\.scale/, 'dragging must not treat CSS pixels as SVG units')
assert.match(canvas, /const TAP_SLOP_PX = 12/, 'small mobile finger jitter must remain a tap so an area can be selected')
assert.match(canvas, /if \(distance <= TAP_SLOP_PX\) return/, 'the map must not pan or consume a zone tap until movement exceeds the tap slop')
const equipmentCanvasClick = canvas.match(/function handleCanvasClick[\s\S]*?\n  const renderArea/)?.[0] ?? ''
assert.doesNotMatch(equipmentCanvasClick, /if \(!onCoordinateSelect\) return/, 'a pointer-captured area tap reaches the SVG canvas and must not be discarded outside placement mode')
assert.match(equipmentCanvasClick, /onSelectArea\(/, 'the SVG canvas click fallback must select the room or zone resolved at the tapped point')

// ── PM/CAL walking workflow ──
assert.match(client, /const walkAreas = useMemo/, 'the map must derive a room-by-room inspection workflow')
assert.match(client, /equipment-mobile-walk-bar/, 'the map must show a dedicated inspection-area picker')
assert.match(client, /พื้นที่ที่กำลังตรวจ/, 'users must be able to choose their current inspection area without zooming')
assert.match(client, /เลือกพื้นที่ถัดไป/, 'users must be able to advance to the next area with outstanding work')
assert.match(client, /inspectionProgress/, 'the inspection bar must show round progress')
const desktopWalkStyles = styles.slice(0, styles.indexOf('@media (max-width: 767px)'))
assert.match(desktopWalkStyles, /\.equipment-mobile-walk-bar \{[^}]*display: grid;/, 'the inspection-area picker must be visible on desktop')
assert.doesNotMatch(desktopWalkStyles, /\.equipment-mobile-walk-bar \{ display: none; \}/, 'the inspection-area picker must not be hidden outside the mobile breakpoint')
assert.match(client, /group\.items\.filter\(\(\{ area \}\) => !area\.isWorkGroupSummary\)/, 'the dropdown must not repeat a group summary area beneath its whole-work option')
assert.match(client, /const directPins = mapPins\.filter\(\(pin\) => pin\.areaCode === area\.code\)/, 'whole-work totals must start from pins assigned directly to each area')
assert.match(client, /total: directPins\.length/, 'whole-work totals must not add a room roll-up to its child zones again')
assert.match(client, /const inspectionAreas = walkAreas\.filter/, 'inspection progress must use leaf areas so parent rooms do not double-count their zones')
assert.match(client, /const groupedWalkAreas = useMemo/, 'the mobile area picker must group areas for PM/CAL workflow')
assert.match(client, /groupEquipmentWalkAreas\(walkAreas\)/, 'the picker must use the canonical work-group partition')
assert.match(walkGroups, /EQUIPMENT_WORK_GROUPS/, 'the picker must preserve the agreed work-group definitions and order')
assert.match(walkGroups, /const groupedCodes = new Set/, 'the picker must build one authoritative set of grouped area codes')
assert.match(walkGroups, /standalone = items\.filter\(\(item\) => !groupedCodes\.has\(item\.area\.code\)\)/, 'an area already assigned to a work group must never be repeated as standalone')
assert.match(client, /group\.summary \? \(/, 'groups without a geometric parent must render a synthetic whole-work option')
assert.match(walkGroups, /work-group:/, 'a synthetic whole-work selection must use a namespaced value that cannot collide with an area code')
assert.match(client, /selectedWorkGroupPins/, 'selecting a synthetic whole-work option must show the combined equipment from that work group')

// ── เปิด/ปิดรายงานแล้วต้องคืนมุมมองแผนที่ และ query ต้องไม่ถูกเพดาน PostgREST ตัดที่ 500 แถว ──
assert.match(client, /key={showPlacement \? 'placement' : 'map'}/, 'opening the unplaced report must remount the canvas at its default view')
assert.match(equipmentMapServer, /fetchAllPages/, 'equipment map data must be loaded through the paginated fetch helper')
assert.match(equipmentMapServer, /classification/, 'equipment map data must include classification for the placement report filter')

// ── ห้ามฝังรหัสสีในคอมโพเนนต์ธุรกิจ (ไม่รวม canvas/สไตล์แผนที่ ซึ่งสืบทอดชุดสีของ lab-map เอง เหมือน LabMapCanvas/LabMapStyles) ──
const ALLOWED_HEX = new Set(['#fff', '#ffffff', '#000', '#000000'])
const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g
for (const [name, source] of [
  ['EquipmentPinDialog.tsx', dialog],
  ['AreaPanel.tsx', areaPanel],
  ['PlacementPanel.tsx', placementPanel],
  ['SurveyRoundBar.tsx', surveyBar],
] as const) {
  const found = (source.match(HEX_PATTERN) ?? []).filter(hex => !ALLOWED_HEX.has(hex.toLowerCase()))
  assert.deepEqual(found, [], `${name} ฝังรหัสสีไว้: ${found.join(', ')} — ให้ใช้ CSS variable ของระบบแทน`)
}

console.log('equipment map UI contract passed')
