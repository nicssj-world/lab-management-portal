import assert from 'node:assert/strict'
import {
  buildEquipmentMapDTO,
  type EquipmentMapRepository,
  type EquipmentMapRow,
} from '../lib/equipment-map/server-builder'
import { EQUIPMENT_AREAS } from '../lib/equipment-map/manifest'

const renamedAreaName = 'ห้องประชุมฝ่ายวิชาการและบริหาร'

const unplacedCalibrationRow: EquipmentMapRow = {
  id: 'calibration-unplaced',
  cbhCode: 'LAB-CAL-001',
  equipmentType: 'Calibration analyzer',
  department: 'เคมีคลินิก',
  classification: 'Analyzer',
  areaCode: null,
  mapX: null,
  mapY: null,
  mapRotation: 0,
  status: 'Active',
  riskLevel: null,
  cbhCodePending: false,
  hospitalAssetNoPending: false,
  needsCalibration: true,
  pmCalData: null,
  responsiblePerson: null,
}

const placedRefrigeratorRow: EquipmentMapRow = {
  ...unplacedCalibrationRow,
  id: 'placed-refrigerator',
  cbhCode: 'LAB-MI-07-001',
  equipmentType: 'Laboratory refrigerator',
  classification: 'Refrigerator',
  areaCode: 'room-microbiology',
  mapX: 120,
  mapY: 120,
  pmCalPlans: [{ id: 'plan-1', equipment_id: 'placed-refrigerator', fiscal_year: 2569, calendar_month: 7, cal_type: 'CAL', due_date: '2026-07-31', record_status: 'active', version: 1 }],
  pmCalResults: [{ id: 'result-1', plan_id: 'plan-1', equipment_id: 'placed-refrigerator', cal_type: 'CAL', completed_date: '2026-07-20', result: 'FAIL' }],
}

const rotatedRefrigeratorRow: EquipmentMapRow = { ...placedRefrigeratorRow, mapRotation: 90 }

// Legacy-imported PM/CAL results are intentionally unlinked (plan_id null); the map must still
// resolve them against a matching plan by fiscal_year/calendar_month/cal_type instead of leaving
// the pin stuck "overdue" despite a completed, passing legacy result — see pm-cal-domain.ts.
const legacyImportRow: EquipmentMapRow = {
  ...placedRefrigeratorRow,
  id: 'legacy-import-cal',
  cbhCode: 'LAB-BM-07-003',
  pmCalPlans: [{ id: 'plan-2', equipment_id: 'legacy-import-cal', fiscal_year: 2569, calendar_month: 7, cal_type: 'CAL', due_date: '2026-07-31', record_status: 'active', version: 1 }],
  pmCalResults: [{ id: 'legacy-result-1', plan_id: null, equipment_id: 'legacy-import-cal', cal_type: 'CAL', completed_date: '2026-07-01', result: 'PASS' }],
}

const repository: EquipmentMapRepository = {
  async areaOverrides() {
    return [
      { code: 'room-sw-2', nameTh: renamedAreaName, isActive: true, kind: 'room' as const, parentCode: null, hasGeometry: true },
      { code: 'zone-molecular-genomics', nameTh: 'ชื่อที่ไม่ควรแสดง', isActive: true, kind: 'room' as const, parentCode: null, hasGeometry: true },
    ]
  },
  async activeSurveyRound() { return null },
  async surveyedEquipmentIds() { return new Set<string>() },
  async equipmentRows() { return [unplacedCalibrationRow, rotatedRefrigeratorRow, legacyImportRow] },
}

async function main() {
  const map = await buildEquipmentMapDTO(repository)
  assert.equal(map.unplaced.length, 1)
  assert.equal(map.unplaced[0]?.needsCalibration, true, 'unplaced equipment must retain needs_calibration for report filtering')
  assert.equal(map.pins.find((pin) => pin.id === placedRefrigeratorRow.id)?.classification, 'Refrigerator', 'placed pins must retain classification for their map symbol')
  assert.equal(map.pins.find((pin) => pin.id === placedRefrigeratorRow.id)?.rotation, 90, 'placed pins must retain their saved orientation')
  assert.equal(map.pins.find((pin) => pin.id === placedRefrigeratorRow.id)?.due, 'overdue', 'failed CAL must use the red/overdue map state')
  assert.equal(map.pins.find((pin) => pin.id === legacyImportRow.id)?.due, 'ok', 'an unlinked legacy-imported PASS result must still clear the matching plan on the map')

  const renamedArea = map.areas.find((area) => area.code === 'room-sw-2')
  const renamedSource = EQUIPMENT_AREAS.find((area) => area.code === 'room-sw-2')
  assert.ok(renamedArea?.label && renamedSource?.label)
  assert.equal(renamedArea.nameTh, renamedAreaName)
  assert.equal(renamedArea.label.lines.join('').replaceAll(' ', ''), renamedAreaName.replaceAll(' ', ''), 'the SVG label must use the saved room name')
  assert.notDeepEqual(renamedArea.label.lines, renamedSource.label.lines, 'a renamed room must not retain manifest label text')
  assert.equal(renamedArea.label.x, renamedSource.label.x, 'renaming must not move the label horizontally')
  assert.equal(renamedArea.label.y, renamedSource.label.y, 'renaming must not move the label vertically')
  assert.ok(renamedArea.label.fontSize >= 8 && renamedArea.label.fontSize <= renamedSource.label.fontSize)

  const unchangedArea = map.areas.find((area) => area.code === 'room-sw-1')
  const unchangedSource = EQUIPMENT_AREAS.find((area) => area.code === 'room-sw-1')
  assert.deepEqual(unchangedArea?.label, unchangedSource?.label, 'an unchanged room must keep its authored label exactly')
  assert.equal(map.areas.find((area) => area.code === 'zone-molecular-genomics')?.label, null, 'renaming an intentionally hidden label must not make it visible')
  console.log('equipment map server builder passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
