import {
  deptFromCode,
  extractFormDocumentCode,
  extractFormTitle,
  isFormFile,
  typeFromCode,
} from '@/lib/documents/code-parse'
import { DOC_TYPES } from '@/lib/validations/document'
import type { Document } from '@/lib/supabase/types'

export type DocType = (typeof DOC_TYPES)[number]
export type Group = 'register' | 'attach'
export type DuplicateChoice = 'link-existing' | 'revise-existing'
export type UploadPhase = 'intake' | 'confirm' | 'submitting' | 'results'
export type DuplicateState =
  | { status: 'idle' | 'checking' | 'none' }
  | { status: 'error'; message: string }
  | { status: 'found'; document: Document }

export type UploadedFile = {
  key: string
  name: string
  size: number
  mime: string
}

export type UploadEntry = {
  id: string
  file: File
  group: Group
  code: string
  title: string
  type: DocType
  department: string
  duplicate: DuplicateState
  duplicateChoice: DuplicateChoice | null
  uploaded: UploadedFile | null
  submitStatus: 'success' | 'failed' | null
  resultReason: string
}

export type RegisterPayloadItem =
  | {
      kind: 'register'
      file: UploadedFile
      document_code: string
      title: string
      type: DocType
      department: string
      revision: string
      owner_name: string
      reviewer_name: string
      approver_name: string
      edit_date: string
      effective_date: string
      visibility: Document['visibility']
    }
  | { kind: 'attach'; file: UploadedFile }
  | { kind: 'link-existing'; existing_document_id: string }
  | { kind: 'revise-existing'; existing_document_id: string; file: UploadedFile }

export type RegisterSetResponse = {
  error?: string
  succeeded?: Array<{ index: number }>
  failed?: Array<{ index: number; error?: string }>
}

export type SubmissionOutcome = { status: 'success' | 'failed'; reason: string }

export const MAX_FILES = 30
export const MAX_FILE_SIZE = 50 * 1024 * 1024

export function fileSizeLabel(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function withoutExtension(name: string) {
  return name.replace(/\.[^.]+$/, '')
}

export function inferredType(code: string, fallback: DocType): DocType {
  const parsed = typeFromCode(code)
  return parsed && (DOC_TYPES as readonly string[]).includes(parsed) ? parsed as DocType : fallback
}

export function createUploadEntry(file: File, mainDoc: Document): UploadEntry {
  const registration = isFormFile(file.name)
  const code = registration ? (extractFormDocumentCode(file.name) ?? '') : ''
  return {
    id: crypto.randomUUID(),
    file,
    group: registration ? 'register' : 'attach',
    code,
    title: extractFormTitle(file.name) ?? withoutExtension(file.name),
    type: inferredType(code, mainDoc.type),
    department: deptFromCode(code) ?? mainDoc.department ?? '',
    duplicate: registration ? { status: 'checking' } : { status: 'idle' },
    duplicateChoice: null,
    uploaded: null,
    submitStatus: null,
    resultReason: '',
  }
}

export function entryLabel(entry: UploadEntry) {
  return entry.group === 'register' && entry.code.trim()
    ? `${entry.code.trim().toUpperCase()} · ${entry.file.name}`
    : entry.file.name
}

export function registrationError(entry: UploadEntry) {
  if (entry.group !== 'register') return ''
  if (!entry.code.trim()) return 'กรุณาระบุรหัสเอกสาร'
  if (!entry.title.trim()) return 'กรุณาระบุชื่อเอกสาร'
  if (entry.duplicate.status === 'checking' || entry.duplicate.status === 'idle') return 'กำลังตรวจสอบรหัสเอกสาร'
  if (entry.duplicate.status === 'error') return entry.duplicate.message
  if (entry.duplicate.status === 'found') {
    if (entry.duplicate.document.status !== 'Published') {
      return `มีรหัสนี้แล้วและอยู่ในสถานะ ${entry.duplicate.document.status} จึงยังลงทะเบียนไม่ได้`
    }
    if (!entry.duplicateChoice) return 'กรุณาเลือกวิธีจัดการเอกสาร Published ที่มีอยู่แล้ว'
  }
  return ''
}

export function parseRegisterSetResponse(response: Response) {
  return response.json().catch(() => ({ error: response.statusText || 'เกิดข้อผิดพลาด' })) as Promise<RegisterSetResponse>
}

export function mapRegisterSetOutcomes(preparedIds: string[], result: RegisterSetResponse) {
  const outcomes = new Map<string, SubmissionOutcome>()
  for (const success of result.succeeded ?? []) {
    const id = preparedIds[success.index]
    if (id) outcomes.set(id, { status: 'success', reason: '' })
  }
  for (const failure of result.failed ?? []) {
    const id = preparedIds[failure.index]
    if (id) outcomes.set(id, { status: 'failed', reason: failure.error ?? 'บันทึกรายการไม่สำเร็จ' })
  }
  for (const id of preparedIds) {
    if (!outcomes.has(id)) outcomes.set(id, { status: 'failed', reason: 'เซิร์ฟเวอร์ไม่ส่งผลลัพธ์ของรายการนี้กลับมา' })
  }
  return outcomes
}

export function retainedUpload(uploadedNow: UploadedFile | undefined, existing: UploadedFile | null) {
  return uploadedNow ?? existing
}

export function failedEntryIds(entries: Array<Pick<UploadEntry, 'id' | 'submitStatus'>>) {
  return entries.filter((entry) => entry.submitStatus === 'failed').map((entry) => entry.id)
}
