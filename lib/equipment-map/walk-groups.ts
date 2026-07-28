/**
 * กลุ่มงานสำหรับวางแผน PM/CAL เท่านั้น ไม่ใช่โครงสร้างเรขาคณิตของผัง:
 * parentCode ยังคงใช้ตรวจการปูพื้นที่ของห้อง/โซน และต้องไม่เปลี่ยนเพื่อจัดหมวดงาน.
 */
export interface EquipmentWorkGroupDefinition {
  code: string
  nameTh: string
  order: number
  areaCodes: readonly string[]
  /** กรอบบนผังที่เป็นของกลุ่มงาน แต่ไม่นำมาเป็นตัวเลือกเดินตรวจ เพราะยอดรวมอาจครอบโซนของกลุ่มอื่น */
  containerAreaCodes?: readonly string[]
  summaryAreaCode?: string
}

export const EQUIPMENT_WORK_GROUPS: readonly EquipmentWorkGroupDefinition[] = [
  { code: 'molecular', nameTh: 'งานอณูชีววิทยา', order: 1, summaryAreaCode: 'zone-molecular-genomics', areaCodes: ['zone-molecular-genomics', 'zone-molecular-1', 'zone-molecular-2', 'zone-molecular-3', 'zone-molecular-4'] },
  { code: 'central-lab', nameTh: 'ห้องปฏิบัติการกลาง', order: 2, summaryAreaCode: 'room-central-lab', areaCodes: ['room-central-lab', 'zone-central-chem-immuno', 'zone-central-microscopy', 'zone-central-hematology'] },
  { code: 'outlab', nameTh: 'งาน OUTLAB', order: 3, containerAreaCodes: ['zone-special-testing'], areaCodes: ['zone-special-testing-upper-1', 'zone-special-testing-upper-2'] },
  { code: 'blood-bank', nameTh: 'งานคลังเลือด', order: 4, areaCodes: ['zone-blood-bank', 'zone-special-testing-lower', 'zone-special-testing-mid', 'room-se-1', 'room-se-2'] },
  { code: 'microbiology', nameTh: 'งานจุลชีววิทยา', order: 5, summaryAreaCode: 'room-microbiology', areaCodes: ['room-microbiology', 'zone-microbiology-main', 'room-microbiology-ne', 'room-north-lab-1', 'room-north-lab-2', 'room-north-lab-3', 'room-north-corridor-1', 'room-north-corridor-2', 'room-north-corridor-3', 'room-north-small'] },
]

export const EQUIPMENT_WORK_GROUP_SELECTION_PREFIX = 'work-group:'

export function equipmentWorkGroupForArea(code: string): EquipmentWorkGroupDefinition | null {
  return EQUIPMENT_WORK_GROUPS.find((group) => group.areaCodes.includes(code) || group.containerAreaCodes?.includes(code)) ?? null
}

interface EquipmentWalkAreaItem {
  area: { code: string }
  total: number
  unsurveyed: number
  overdue: number
  dueSoon: number
}

export function groupEquipmentWalkAreas<T extends EquipmentWalkAreaItem>(items: readonly T[]) {
  const itemByCode = new Map(items.map((item) => [item.area.code, item]))
  const groupedCodes = new Set(EQUIPMENT_WORK_GROUPS.flatMap((group) => [...group.areaCodes, ...(group.containerAreaCodes ?? [])]))
  const groups = EQUIPMENT_WORK_GROUPS
    .map((group) => {
      const groupItems = group.areaCodes.map((code) => itemByCode.get(code)).filter((item): item is T => item !== undefined)
      const summary = group.summaryAreaCode ? null : groupItems.reduce((result, item) => ({
        ...result,
        total: result.total + item.total,
        unsurveyed: result.unsurveyed + item.unsurveyed,
        overdue: result.overdue + item.overdue,
        dueSoon: result.dueSoon + item.dueSoon,
      }), {
        selectionCode: `${EQUIPMENT_WORK_GROUP_SELECTION_PREFIX}${group.code}`,
        nameTh: group.nameTh,
        total: 0,
        unsurveyed: 0,
        overdue: 0,
        dueSoon: 0,
      })
      return {
        code: group.code,
        nameTh: group.nameTh,
        order: group.order,
        items: groupItems,
        summary,
      }
    })
    .filter((group) => group.items.length > 0)
  const standalone = items.filter((item) => !groupedCodes.has(item.area.code))

  return { groups, standalone }
}
