export const LAB_CODE_DEPARTMENTS: Record<string, string> = {
  CC: 'งานเคมีคลินิก',
  BB: 'งานคลังเลือด',
  BM: 'งานอณูชีววิทยา',
  DR: 'DRA',
  PO: 'POCT',
  ST: 'คลังน้ำยา',
  MI: 'งานจุลชีววิทยา',
  MP: 'งานจุลทรรศนศาสตร์คลินิก',
  SR: 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ',
  OP: 'งานบริการผู้ป่วยนอก',
  IM: 'งานภูมิคุ้มกันวิทยาคลินิก',
  LM: 'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี',
  MT: 'สำนักงานกลุ่มงานเทคนิคการแพทย์',
}

/** The equipment registry format is LAB-[department]-[classification]-[sequence]. */
export const LAB_CODE_FORMAT = 'LAB-XX-NN-XXX'

export const LAB_CODE_CLASSIFICATIONS: Record<string, string> = {
  '01': 'AutoClave',
  '02': 'Centrifuge',
  '03': 'Water Bath',
  '04': 'HeatingBlock',
  '05': 'Incubator',
  '06': 'Electronic Balance',
  '07': 'Refrigerator',
  '08': 'Digital Thermometer',
  '09': 'Volumetric Pipette',
  '10': 'Auto Pipette',
  '11': 'BSC',
  '12': 'Microscope',
  '13': 'Calibration Weight',
  '14': 'Analyzer',
  '15': 'Analyzer (Rental)',
  '16': 'Rotator',
  '17': 'Vortex mixer',
  '18': 'Timer',
  '19': 'UPS',
}

/** Read the two-letter department segment from both short and full LAB codes. */
export function parseLabDepartmentCode(code: string | null | undefined) {
  const match = String(code ?? '').trim().toUpperCase().match(/^LAB-([A-Z]{2})(?:-|$)/)
  return match ? match[1] : null
}

export function parseLabCode(code: string | null | undefined) {
  const match = String(code ?? '').trim().toUpperCase().match(/^LAB-([A-Z]{2})-([0-9]{2})(?:-|$)/)
  if (!match) return null
  return { departmentCode: match[1], classificationCode: match[2] }
}

/**
 * Keep recognized LAB codes comparable for uniqueness checks. Unknown/non-LAB
 * values are preserved so legacy records and manually assigned identifiers
 * remain usable.
 */
export function normalizeLabCode(code: string | null | undefined): string | null {
  const value = String(code ?? '').trim()
  if (!value) return null

  const compact = value.replace(/\s+/g, '')
  return parseLabDepartmentCode(compact) ? compact.toUpperCase() : value
}

export function getLabCodeInfo(code: string | null | undefined) {
  const normalizedCode = normalizeLabCode(code)
  const parsed = parseLabCode(normalizedCode)
  const departmentCode = parseLabDepartmentCode(normalizedCode)
  return {
    department: departmentCode ? LAB_CODE_DEPARTMENTS[departmentCode] ?? null : null,
    classification: parsed ? LAB_CODE_CLASSIFICATIONS[parsed.classificationCode] ?? null : null,
  }
}
