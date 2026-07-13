import { DOC_TYPES } from '@/lib/validations/document'

export const DEPT_BY_PREFIX: Record<string, string> = {
  QP: 'กลุ่มงานเทคนิคการแพทย์',
  QM: 'กลุ่มงานเทคนิคการแพทย์',
  MN: 'กลุ่มงานเทคนิคการแพทย์',
  OV: 'กลุ่มงานเทคนิคการแพทย์',
  BB: 'งานคลังเลือด',
  MI: 'งานจุลชีววิทยาคลินิก',
  HE: 'งานโลหิตวิทยาคลินิก',
  IM: 'งานภูมิคุ้มกันวิทยาคลินิก',
  MP: 'งานจุลทรรศน์ศาสตร์คลินิก',
  CC: 'งานเคมีคลินิก',
  LM: 'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี',
  BM: 'งานอณูชีววิทยา',
  SR: 'งานตรวจพิเศษและปฏิบัติการตรวจต่อ',
  OP: 'งานชันสูตรผู้ป่วยนอก',
}

export const TYPE_BY_PREFIX: Record<string, string> = {
  QP: 'QP', WI: 'WI',
  QM: 'QM', MN: 'Manual',
  FM: 'Form', FR: 'Form',
  PL: 'Policy', PO: 'Policy',
  RF: 'Reference',
  CF: 'Card file',
  LB: 'Lb',
}

export function typeFromCode(code: string): string | null {
  const first = code.split('-')[0]?.toUpperCase() ?? ''
  if (DOC_TYPES.includes(first as typeof DOC_TYPES[number])) return first
  return TYPE_BY_PREFIX[first] ?? null
}

export function deptFromCode(code: string): string | null {
  for (const seg of code.split('-')) {
    const prefix = seg.match(/^([A-Z]{2})/)?.[1] ?? ''
    if (DEPT_BY_PREFIX[prefix]) return DEPT_BY_PREFIX[prefix]
  }
  return null
}

export function isFormFile(filename: string): boolean {
  return /^(?:Fm|FR|Rf|Cf)-/i.test(filename)
}

export function extractFormDocumentCode(filename: string): string | null {
  // "Fm-QP-LAB-03-05 แบบบันทึก....pdf" → "FM-QP-LAB-03-05"
  const m = filename.match(/^([^\s.]+)/)
  return m ? m[1].toUpperCase() : null
}

export function extractFormTitle(filename: string): string | null {
  // "Fm-QP-LAB-03-05 แบบบันทึก....pdf" → "แบบบันทึก...."
  const withoutExt = filename.replace(/\.[^.]+$/, '')
  const spaceIdx = withoutExt.indexOf(' ')
  if (spaceIdx === -1) return null
  return withoutExt.slice(spaceIdx + 1).trim() || null
}

export function extractParentCode(filename: string): string | null {
  // Take the code token right after Fm-/FR-/Rf-/Cf- (stop at first space or extension)
  const m = filename.match(/^(?:Fm|FR|Rf|Cf)-([^\s.]+)/i)
  if (!m) return null
  let code = m[1]
  // Strip underscore variant: Fm-QP-LAB-01_01 → QP-LAB-01
  code = code.replace(/_\d+$/, '')
  // Strip dash variant when 4+ segments and last segment is numeric: Fm-QP-LAB-03-05 → QP-LAB-03
  const parts = code.split('-')
  if (parts.length >= 4 && /^\d+$/.test(parts[parts.length - 1])) {
    code = parts.slice(0, -1).join('-')
  }
  return code.toUpperCase()
}
