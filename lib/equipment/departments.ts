/**
 * Canonical departments offered by equipment workflows.
 *
 * Live values are merged in as well so imported or historical department names
 * remain available without letting each screen maintain a different list.
 */
export const EQUIPMENT_DEPARTMENTS = [
  'สำนักงานกลุ่มงานเทคนิคการแพทย์',
  'โลหิตวิทยา',
  'เคมีคลินิก',
  'จุลชีววิทยา',
  'ภูมิคุ้มกันวิทยา',
  'จุลทรรศน์',
  'อณูชีววิทยา',
  'คลังเลือด',
  'ผู้ป่วยนอก',
  'คลังน้ำยา',
  'ศสม.',
  'POCT',
  'DRA',
  'ตรวจพิเศษและปฏิบัติการตรวจต่อ',
  'ไม่มีเจ้าของ',
] as const

export function mergeEquipmentDepartments(
  values: readonly (string | null | undefined)[] = [],
): string[] {
  return Array.from(new Set([
    ...EQUIPMENT_DEPARTMENTS,
    ...values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)),
  ])).sort((left, right) => left.localeCompare(right, 'th'))
}
