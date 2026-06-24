export const LAB_CODE_DEPARTMENTS: Record<string, string> = {
  CC: 'เคมีคลินิก',
  BB: 'คลังเลือด',
  BM: 'อณูชีววิทยา',
  DR: 'DRA',
  PO: 'POCT',
  ST: 'คลังน้ำยา',
  MI: 'จุลชีววิทยา',
  MP: 'จุลทรรศน์',
  SR: 'ตรวจพิเศษและปฏิบัติการตรวจต่อ',
  OP: 'ผู้ป่วยนอก',
  IM: 'ภูมิคุ้มกันวิทยา',
  LM: 'ศสม.',
}

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

export function parseLabCode(code: string | null | undefined) {
  const match = String(code ?? '').trim().toUpperCase().match(/^LAB-([A-Z]{2})-([0-9]{2})(?:-|$)/)
  if (!match) return null
  return { departmentCode: match[1], classificationCode: match[2] }
}

export function getLabCodeInfo(code: string | null | undefined) {
  const parsed = parseLabCode(code)
  return {
    department: parsed ? LAB_CODE_DEPARTMENTS[parsed.departmentCode] ?? null : null,
    classification: parsed ? LAB_CODE_CLASSIFICATIONS[parsed.classificationCode] ?? null : null,
  }
}
