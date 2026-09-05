import {
  deptFromCode,
  extractFormDocumentCode,
  extractFormTitle,
  isFormFile,
  typeFromCode,
} from '@/lib/documents/code-parse'
import { DOC_TYPES } from '@/lib/validations/document'
import { MAX_DOCUMENT_CODE_LENGTH, MAX_DOCUMENT_TITLE_LENGTH } from '@/lib/validations/document-set'
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
  upload_id: string
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
  validationIssues?: RegisterSetValidationIssue[]
  succeeded?: Array<{ index: number }>
  failed?: Array<{ index: number; error?: string }>
}

export type RegisterSetValidationIssue = {
  index: number | null
  field: string | null
  message: string
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
    department: mainDoc.department ?? deptFromCode(code) ?? '',
    duplicate: registration ? { status: 'checking' } : { status: 'idle' },
    duplicateChoice: null,
    uploaded: null,
    submitStatus: null,
    resultReason: '',
  }
}

export function entryLabel(entry: UploadEntry) {
  if (entry.group !== 'register' || !entry.code.trim()) return entry.file.name

  const code = entry.code.trim().toUpperCase()
  const filenameCode = extractFormDocumentCode(entry.file.name)
  return filenameCode === code ? entry.file.name : `${code} · ${entry.file.name}`
}

export function documentCodeTooLongMessage() {
  return `รหัสเอกสารยาวเกิน ${MAX_DOCUMENT_CODE_LENGTH} ตัวอักษร ระบบอ่านรหัสถึงช่องว่างแรก กรุณาตั้งชื่อไฟล์เป็น [รหัส] [ชื่อเอกสาร].นามสกุล เช่น FM-WI-G-LM01-01 แบบบันทึก.xlsx`
}

export function documentTitleTooLongMessage() {
  return `ชื่อเอกสารยาวเกิน ${MAX_DOCUMENT_TITLE_LENGTH} ตัวอักษร กรุณาย่อชื่อเอกสารก่อนลงทะเบียน`
}

export const documentFileNameFormatMessage = 'ชื่อไฟล์ต้องอยู่ในรูปแบบ [รหัส] [ชื่อเอกสาร].นามสกุล โดยต้องเว้นวรรคระหว่างรหัสกับชื่อเอกสาร'

export function registrationError(entry: UploadEntry) {
  if (entry.group !== 'register') return ''
  const code = entry.code.trim()
  const title = entry.title.trim()
  if (!code) return 'กรุณาระบุรหัสเอกสาร'
  if (!title) return 'กรุณาระบุชื่อเอกสาร'
  if (code.length > MAX_DOCUMENT_CODE_LENGTH) return documentCodeTooLongMessage()
  if (title.length > MAX_DOCUMENT_TITLE_LENGTH) return documentTitleTooLongMessage()
  if (code.toUpperCase() === title.toUpperCase()) return documentFileNameFormatMessage
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

export function formatRegisterSetValidationIssue(issue: RegisterSetValidationIssue) {
  if (issue.field === 'document_code' && issue.message.toLowerCase().includes('at most 50')) return documentCodeTooLongMessage()
  if (issue.field === 'title' && issue.message.toLowerCase().includes('at most 200')) return documentTitleTooLongMessage()
  if (issue.field === 'document_code') return 'รหัสเอกสารไม่ถูกต้อง กรุณาตรวจสอบรหัสและเว้นวรรคระหว่างรหัสกับชื่อไฟล์'
  if (issue.field === 'title') return 'ชื่อเอกสารไม่ถูกต้อง กรุณาตรวจสอบชื่อเอกสาร'
  if (issue.field) return `ข้อมูล ${issue.field} ไม่ถูกต้อง กรุณาตรวจสอบรายการนี้`
  return 'ข้อมูลชุดเอกสารไม่ถูกต้อง กรุณาตรวจสอบรายการอีกครั้ง'
}

const batchValidationFailureMessage = 'รายการนี้ยังไม่ได้บันทึก เนื่องจากมีรายการอื่นในชุดไม่ผ่านการตรวจสอบ กรุณาแก้ไขรายการที่แจ้งแล้วลองใหม่'

export function mapRegisterSetValidationOutcomes(preparedIds: string[], issues: RegisterSetValidationIssue[]) {
  const messagesByIndex = new Map<number, string[]>()
  for (const issue of issues) {
    if (typeof issue.index !== 'number' || issue.index < 0 || issue.index >= preparedIds.length) continue
    const messages = messagesByIndex.get(issue.index) ?? []
    messages.push(formatRegisterSetValidationIssue(issue))
    messagesByIndex.set(issue.index, messages)
  }

  return new Map(preparedIds.map((id, index) => [id, {
    status: 'failed' as const,
    reason: messagesByIndex.get(index)?.join(' · ') ?? batchValidationFailureMessage,
  }]))
}

export function parseRegisterSetResponse(response: Response) {
  return response.json().catch(() => ({ error: response.statusText || 'เกิดข้อผิดพลาด' })) as Promise<RegisterSetResponse>
}

export const batchNotSavedMessage = 'ชุดเอกสารนี้ยังไม่ได้บันทึก เนื่องจากมีรายการหนึ่งไม่ผ่านการอัปโหลดหรือการตรวจสอบ'

export function mapBatchUploadFailureOutcomes(
  entryIds: readonly string[],
  failures: ReadonlyMap<string, string>,
) {
  return new Map(entryIds.map((id) => [id, {
    status: 'failed' as const,
    reason: failures.get(id) ?? batchNotSavedMessage,
  }]))
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
