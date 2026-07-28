import { computeEquipmentPmCalState, type PmCalPlanRecord, type PmCalResultRecord } from '@/lib/equipment/pm-cal-domain'
import { computePmCalDue, type PmCalDueState } from '@/lib/equipment/pm-cal-due'
import type { Equipment } from '@/lib/queries/equipment'
import { labelForRenamedArea } from './label'
import { equipmentWorkGroupForArea, EQUIPMENT_AREAS, EQUIPMENT_DOORS, EQUIPMENT_MAP_VERSION, EQUIPMENT_MAP_VIEW_BOX, EQUIPMENT_WALLS } from './manifest'
import type {
  EquipmentActiveRoundDTO,
  EquipmentAreaCounts,
  EquipmentAreaDTO,
  EquipmentMapDTO,
  EquipmentPinDTO,
  EquipmentUnplacedDTO,
} from './types'

export interface EquipmentAreaOverrideRow {
  code: string
  nameTh: string
  isActive: boolean
  kind: 'room' | 'zone'
  parentCode: string | null
  hasGeometry: boolean
}

export interface EquipmentMapRow {
  id: string
  cbhCode: string | null
  equipmentType: string
  department: string
  classification: string | null
  areaCode: string | null
  mapX: number | null
  mapY: number | null
  mapRotation: 0 | 90 | 180 | 270
  status: Equipment['status']
  riskLevel: Equipment['risk_level']
  cbhCodePending: boolean
  hospitalAssetNoPending: boolean
  needsCalibration: boolean
  pmCalData: Equipment['pm_cal_data']
  pmCalPlans?: readonly PmCalPlanRecord[]
  pmCalResults?: readonly PmCalResultRecord[]
  responsiblePerson: string | null
}

export interface EquipmentMapRepository {
  areaOverrides(): Promise<readonly EquipmentAreaOverrideRow[]>
  activeSurveyRound(): Promise<EquipmentActiveRoundDTO | null>
  surveyedEquipmentIds(roundId: string): Promise<ReadonlySet<string>>
  equipmentRows(): Promise<readonly EquipmentMapRow[]>
}

function emptyCounts(): EquipmentAreaCounts {
  return { total: 0, active: 0, broken: 0, dueSoon: 0, overdue: 0, pendingReg: 0, unsurveyed: 0 }
}

function bumpCounts(counts: EquipmentAreaCounts, pin: EquipmentPinDTO) {
  counts.total += 1
  if (pin.status === 'Active') counts.active += 1
  if (pin.status === 'ชำรุด') counts.broken += 1
  if (pin.due === 'due_soon') counts.dueSoon += 1
  if (pin.due === 'overdue') counts.overdue += 1
  if (pin.pendingRegistration) counts.pendingReg += 1
  if (!pin.surveyed) counts.unsurveyed += 1
}

export async function buildEquipmentMapDTO(repository: EquipmentMapRepository): Promise<EquipmentMapDTO> {
  const [areaOverrides, activeRound, rows] = await Promise.all([
    repository.areaOverrides(),
    repository.activeSurveyRound(),
    repository.equipmentRows(),
  ])
  const surveyedIds = activeRound ? await repository.surveyedEquipmentIds(activeRound.id) : new Set<string>()

  const overrideByCode = new Map(areaOverrides.map((row) => [row.code, row]))
  const areaDefByCode = new Map(EQUIPMENT_AREAS.map((area) => [area.code, area]))
  // พื้นที่นอกผัง (สร้างผ่าน POST /api/admin/equipment/areas) ไม่มีใน manifest — รวม code ทั้งสองแหล่งไว้นับ count ด้วยกัน
  const allAreaCodes = new Set<string>([...areaDefByCode.keys(), ...overrideByCode.keys()])
  const countsByArea = new Map<string, EquipmentAreaCounts>([...allAreaCodes].map((code) => [code, emptyCounts()]))
  const parentCodeOf = (code: string): string | null | undefined =>
    areaDefByCode.get(code)?.parentCode ?? overrideByCode.get(code)?.parentCode ?? undefined

  const pins: EquipmentPinDTO[] = []
  const unplaced: EquipmentUnplacedDTO[] = []

  for (const row of rows) {
    const newState = row.pmCalPlans
      ? computeEquipmentPmCalState(row.status !== 'Inactive' && row.needsCalibration, [...row.pmCalPlans], [...(row.pmCalResults ?? [])])
      : null
    const due: PmCalDueState = newState == null
      ? computePmCalDue({ status: row.status, needs_calibration: row.needsCalibration, pm_cal_data: row.pmCalData }).worst
      : newState === 'failed' || newState === 'overdue'
        ? 'overdue'
        : newState === 'due_soon'
          ? 'due_soon'
          : newState === 'unplanned'
            ? 'unplanned'
            : newState === 'not_required'
              ? 'not_required'
              : 'ok'

    const placed = row.mapX != null && row.mapY != null

    // รายงาน "ยังไม่ปักหมุด" นับจากพิกัดล้วน ๆ ไม่ใช่จาก area_code — เครื่องมือที่กำหนดโซนไว้แล้ว
    // แต่ยังไม่ปักหมุดต้องยังโผล่ในรายงานนี้ด้วย เพื่อให้ทยอยเดินปักหมุดให้ครบได้
    if (!placed) {
      unplaced.push({
        id: row.id,
        code: row.cbhCode,
        name: row.equipmentType,
        department: row.department,
        classification: row.classification,
        needsCalibration: row.needsCalibration,
        areaCode: row.areaCode,
      })
    }

    // ยังไม่กำหนดพื้นที่เลย — ไม่มีอะไรให้นับ/แสดงในห้อง/โซนไหนต่อ
    if (row.areaCode == null) continue

    const pin: EquipmentPinDTO = {
      id: row.id,
      code: row.cbhCode,
      name: row.equipmentType,
      department: row.department,
      classification: row.classification,
      areaCode: row.areaCode,
      x: row.mapX,
      y: row.mapY,
      rotation: row.mapRotation,
      placed,
      status: row.status,
      riskLevel: row.riskLevel,
      pendingRegistration: row.cbhCodePending || row.hospitalAssetNoPending,
      due,
      surveyed: surveyedIds.has(row.id),
      responsiblePerson: row.responsiblePerson,
    }
    // กำหนดโซนแล้วต้องนับ/แสดงในรายการของโซนนั้นเสมอ ไม่ว่าจะปักหมุดแล้วหรือยัง —
    // ไม่งั้นเครื่องมือที่เพิ่งกำหนดโซน (ยังไม่ทันปักหมุด) จะดู "หายไป" จากแผนผังทั้งที่กำหนดไว้แล้วจริง
    pins.push(pin)

    // นับให้พื้นที่ตัวเอง แล้วไล่ขึ้นไปนับให้ห้องแม่ด้วย (ถ้าพื้นที่เป็นโซน)
    let currentCode: string | undefined = pin.areaCode
    const visited = new Set<string>()
    while (currentCode && !visited.has(currentCode)) {
      visited.add(currentCode)
      const counts = countsByArea.get(currentCode)
      if (counts) bumpCounts(counts, pin)
      currentCode = parentCodeOf(currentCode) ?? undefined
    }
  }

  const manifestAreas: EquipmentAreaDTO[] = EQUIPMENT_AREAS.map((definition) => {
    const override = overrideByCode.get(definition.code)
    const workGroup = equipmentWorkGroupForArea(definition.code)
    const nameTh = override?.nameTh ?? definition.nameTh
    const label = definition.label && override && nameTh !== definition.nameTh
      ? labelForRenamedArea(nameTh, definition.rect, definition.label)
      : definition.label ?? null
    return {
      code: definition.code,
      nameTh,
      kind: definition.kind,
      parentCode: definition.parentCode ?? null,
      workGroupCode: workGroup?.code ?? null,
      workGroupNameTh: workGroup?.nameTh ?? null,
      workGroupOrder: workGroup?.order ?? null,
      isWorkGroupSummary: workGroup?.summaryAreaCode === definition.code,
      rect: definition.rect,
      polygon: definition.polygon ?? null,
      label,
      fillTone: definition.fillTone ?? null,
      hasGeometry: true,
      isActive: override?.isActive ?? true,
      counts: countsByArea.get(definition.code) ?? emptyCounts(),
    }
  })
  // พื้นที่นอกผังที่มีเฉพาะใน DB (สร้างเพิ่มเองผ่าน POST /api/admin/equipment/areas) — ไม่มีรูปทรง/ป้าย
  const customAreas: EquipmentAreaDTO[] = areaOverrides
    .filter((row) => !areaDefByCode.has(row.code))
    .map((row) => ({
      code: row.code,
      nameTh: row.nameTh,
      kind: row.kind,
      parentCode: row.parentCode,
      workGroupCode: null,
      workGroupNameTh: null,
      workGroupOrder: null,
      isWorkGroupSummary: false,
      rect: null,
      polygon: null,
      label: null,
      fillTone: null,
      hasGeometry: row.hasGeometry,
      isActive: row.isActive,
      counts: countsByArea.get(row.code) ?? emptyCounts(),
    }))
  const areas: EquipmentAreaDTO[] = [...manifestAreas, ...customAreas]

  return {
    version: EQUIPMENT_MAP_VERSION,
    viewBox: EQUIPMENT_MAP_VIEW_BOX,
    walls: EQUIPMENT_WALLS,
    doors: EQUIPMENT_DOORS,
    areas,
    pins,
    unplaced,
    activeRound,
  }
}
