export const COVER_REQUIRED_TYPES = ['QP', 'WI'] as const
export const SOURCE_FILE_EXTENSIONS = ['doc', 'docx', 'xls', 'xlsx'] as const
export const PDF_EXTENSIONS = ['pdf'] as const

export type DocumentStatus = 'Draft' | 'Review' | 'Approved' | 'Published' | 'Obsolete'

export type DocumentFileFields = {
  type?: string | null
  status?: string | null
  file_url?: string | null
  source_pdf_url?: string | null
}

export const DOCUMENT_TYPE_LABELS: Record<string, { th: string; en: string }> = {
  QP: { th: 'ระเบียบปฏิบัติทางคุณภาพ', en: 'Quality Procedure (QP)' },
  WI: { th: 'วิธีปฏิบัติงาน', en: 'Work Instruction (WI)' },
  Form: { th: 'แบบฟอร์ม', en: 'Form' },
  Policy: { th: 'นโยบาย', en: 'Policy' },
  Manual: { th: 'คู่มือ', en: 'Manual' },
  Record: { th: 'บันทึกคุณภาพ', en: 'Record' },
  Reference: { th: 'เอกสารอ้างอิง', en: 'Reference' },
  'Card file': { th: 'Card file', en: 'Card file' },
  Others: { th: 'เอกสารอื่นๆ', en: 'Others' },
}

export const DEFAULT_DOCUMENT_AUDIENCE =
  'นักเทคนิคการแพทย์ นักวิทยาศาสตร์การแพทย์ เจ้าพนักงานวิทยาศาสตร์การแพทย์ และบุคลากรที่ปฏิบัติงานภายในกลุ่มงานเทคนิคการแพทย์'

export function isCoverRequiredType(type: string | null | undefined) {
  return COVER_REQUIRED_TYPES.includes(type as (typeof COVER_REQUIRED_TYPES)[number])
}

export function isReviewOrLater(status: string | null | undefined) {
  return status === 'Review' || status === 'Approved' || status === 'Published'
}

export function fileExt(filename: string | null | undefined) {
  const clean = filename?.split(/[?#]/)[0] ?? ''
  const last = clean.split('/').pop() ?? ''
  const dot = last.lastIndexOf('.')
  if (dot <= 0 || dot === last.length - 1) return ''
  return last.slice(dot + 1).toLowerCase()
}

export function isPdfFile(file: File | { name?: string; type?: string } | null | undefined) {
  if (!file) return false
  return file.type === 'application/pdf' || fileExt(file.name) === 'pdf'
}

export function isSourceFile(file: File | { name?: string } | null | undefined) {
  if (!file) return false
  return SOURCE_FILE_EXTENSIONS.includes(fileExt(file.name) as (typeof SOURCE_FILE_EXTENSIONS)[number])
}

export function canMoveToStatus(doc: DocumentFileFields, nextStatus: string) {
  if (!isReviewOrLater(nextStatus)) return { ok: true as const }

  if (isCoverRequiredType(doc.type)) {
    if (!doc.source_pdf_url && !doc.file_url) {
      return { ok: false as const, error: 'QP/WI ต้องมีไฟล์ PDF ก่อนส่งเข้า Review' }
    }
    return { ok: true as const }
  }

  if (!doc.file_url) {
    return { ok: false as const, error: 'ต้องมีไฟล์ทางการก่อนส่งเข้า Review' }
  }
  return { ok: true as const }
}

export function nextRevisionValue(current: string | null | undefined) {
  const trimmed = (current ?? '').trim()
  if (!trimmed) return '1'
  const match = trimmed.match(/^(\D*)(\d+)(\D*)$/)
  if (!match) return `${trimmed}.1`
  const [, prefix, num, suffix] = match
  const next = String(Number(num) + 1).padStart(num.length, '0')
  return `${prefix}${next}${suffix}`
}

export function isPublishedMetadataField(field: string) {
  return [
    'title',
    'department',
    'owner_name',
    'reviewer_name',
    'approver_name',
    'reviewer_id',
    'approver_id',
    'audience_text',
    'visibility',
    'description',
  ].includes(field)
}

export function workflowRole(actor: { role: string; doc_role?: string | null }) {
  return actor.doc_role ?? actor.role
}

export function canCorrectPublishedMetadata(actor: { role: string; doc_role?: string | null }) {
  return actor.role === 'Admin' || workflowRole(actor) === 'Document Controller'
}

export function canManageDocumentProfile(
  actor: { id: string; role: string; doc_role?: string | null },
  targetId: string,
) {
  if (actor.role === 'Admin' || actor.role === 'Manager') return true
  return workflowRole(actor) === 'Reviewer' && actor.id === targetId
}
