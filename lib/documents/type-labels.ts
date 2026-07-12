// Single source of truth for document-type display labels — "ชื่อเต็ม (Code)".
// DOC_TYPES itself (the list of valid type values) lives in lib/validations/document.ts,
// which feeds the zod schema; re-exported here so label consumers only need one import.
export { DOC_TYPES } from '@/lib/validations/document'

export const TYPE_LABEL: Record<string, string> = {
  QM: 'คู่มือคุณภาพ (QM)',
  QP: 'ระเบียบปฏิบัติ (QP)',
  WI: 'วิธีปฏิบัติงาน (WI)',
  Reference: 'เอกสารอ้างอิง (Rf)',
  Form: 'แบบฟอร์ม (Fm)',
  'Card file': 'เอกสารประกอบการปฏิบัติงาน (Cf)',
  Lb: 'สมุดบันทึก (Lb)',
  Manual: 'คู่มือ (MN)',
  Policy: 'นโยบาย (CBH)',
  Others: 'เอกสารอื่นๆ',
}
