import { DEPARTMENTS } from '@/lib/validations/user-schema'

/**
 * Values that are useful in the equipment registry but are not staff
 * departments. Keep these separate from the shared department list so they do
 * not accidentally become valid profile departments.
 */
const EQUIPMENT_ONLY_DEPARTMENTS = [
  'คลังน้ำยา',
  'POCT',
  'DRA',
  'ไม่มีเจ้าของ',
] as const

/** The equipment registry uses the same display names as the main department list. */
export const EQUIPMENT_DEPARTMENTS = [
  ...DEPARTMENTS,
  ...EQUIPMENT_ONLY_DEPARTMENTS,
] as const

/**
 * Historical/imported equipment data used short names, English labels, and a
 * few old OUT LAB spellings. They all point to one canonical department name.
 * The aliases are intentionally kept at this boundary so old rows can be
 * migrated without breaking filters during the rollout.
 */
const DEPARTMENT_ALIASES = {
  'เคมีคลินิก': 'งานเคมีคลินิก',
  'โลหิตวิทยา': 'งานโลหิตวิทยาคลินิก',
  'ภูมิคุ้มกันวิทยา': 'งานภูมิคุ้มกันวิทยาคลินิก',
  'จุลทรรศน์': 'งานจุลทรรศนศาสตร์คลินิก',
  'จุลทรรศน์ศาสตร์': 'งานจุลทรรศนศาสตร์คลินิก',
  'จุลทรรศน์ศาสตร์คลินิก': 'งานจุลทรรศนศาสตร์คลินิก',
  'อณูชีววิทยา': 'งานอณูชีววิทยา',
  'จุลชีววิทยา': 'งานจุลชีววิทยา',
  'คลังเลือด': 'งานคลังเลือด',
  'ผู้ป่วยนอก': 'งานบริการผู้ป่วยนอก',
  'OPD': 'งานบริการผู้ป่วยนอก',
  'ศสม': 'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี',
  'ศสม.': 'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี',
  'Muang Chonburi': 'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี',
  'ตรวจพิเศษและปฏิบัติการตรวจต่อ': 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ',
  'งานตรวจพิเศษและปฏิบัติการตรวจต่อ': 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ',
  'ตรวจพิเศษและตรวจต่อ': 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ',
  'งานตรวจพิเศษและตรวจต่อ': 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ',
} as const satisfies Record<string, string>

function normalizeDepartmentText(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

function departmentKey(value: unknown): string {
  return normalizeDepartmentText(value).toLocaleLowerCase('th-TH')
}

const canonicalByKey = new Map(
  EQUIPMENT_DEPARTMENTS.map((department) => [departmentKey(department), department]),
)
const aliasByKey = new Map(
  Object.entries(DEPARTMENT_ALIASES).map(([alias, canonical]) => [departmentKey(alias), canonical]),
)

/** Convert a stored, imported, or user-entered value to the display name used by the main system. */
export function canonicalEquipmentDepartment(value: string | null | undefined): string {
  const normalized = normalizeDepartmentText(value)
  if (!normalized) return ''
  return aliasByKey.get(departmentKey(normalized))
    ?? canonicalByKey.get(departmentKey(normalized))
    ?? normalized
}

/** Return all stored spellings that should be included when filtering a canonical value. */
export function equipmentDepartmentVariants(value: string | null | undefined): string[] {
  const canonical = canonicalEquipmentDepartment(value)
  if (!canonical) return []

  const aliases = Object.entries(DEPARTMENT_ALIASES)
    .filter(([, target]) => target === canonical)
    .map(([alias]) => normalizeDepartmentText(alias))

  return Array.from(new Set([canonical, ...aliases]))
}

export function mergeEquipmentDepartments(
  values: readonly (string | null | undefined)[] = [],
): string[] {
  return Array.from(new Set([
    ...EQUIPMENT_DEPARTMENTS,
    ...values.map(canonicalEquipmentDepartment).filter(Boolean),
  ])).sort((left, right) => left.localeCompare(right, 'th'))
}

/**
 * Departments currently represented by equipment rows. Unlike
 * mergeEquipmentDepartments(), this deliberately does not seed empty
 * departments into a filter dropdown.
 */
export function equipmentDepartmentsInUse(
  values: readonly (string | null | undefined)[] = [],
): string[] {
  return Array.from(new Set(
    values.map(canonicalEquipmentDepartment).filter(Boolean),
  )).sort((left, right) => left.localeCompare(right, 'th'))
}
