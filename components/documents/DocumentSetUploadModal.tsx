'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import {
  deptFromCode,
  extractFormDocumentCode,
  extractFormTitle,
  isFormFile,
  typeFromCode,
} from '@/lib/documents/code-parse'
import { uploadFileWithProgress } from '@/lib/documents/upload-with-progress'
import { DOC_TYPES } from '@/lib/validations/document'
import type { Document } from '@/lib/supabase/types'

type DocType = (typeof DOC_TYPES)[number]
type Group = 'register' | 'attach'
type DuplicateChoice = 'link-existing' | 'revise-existing'
type DuplicateState =
  | { status: 'idle' | 'checking' | 'none' }
  | { status: 'error'; message: string }
  | { status: 'found'; document: Document }

type UploadedFile = {
  key: string
  name: string
  size: number
  mime: string
}

type Entry = {
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

type RegisterPayloadItem =
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

type RegisterSetResponse = {
  error?: string
  succeeded?: Array<{ index: number }>
  failed?: Array<{ index: number; error?: string }>
}

interface Props {
  mainDoc: Document
  onClose: () => void
  onDone: () => void
}

const MAX_FILES = 30
const MAX_FILE_SIZE = 50 * 1024 * 1024

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--ink)',
  fontFamily: 'inherit',
  fontSize: 12.5,
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  color: 'var(--muted)',
  fontSize: 11.5,
  fontWeight: 600,
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function withoutExtension(name: string) {
  return name.replace(/\.[^.]+$/, '')
}

function inferredType(code: string, fallback: DocType): DocType {
  const parsed = typeFromCode(code)
  return parsed && (DOC_TYPES as readonly string[]).includes(parsed) ? parsed as DocType : fallback
}

function createEntry(file: File, mainDoc: Document): Entry {
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

function entryLabel(entry: Entry) {
  return entry.group === 'register' && entry.code.trim()
    ? `${entry.code.trim().toUpperCase()} · ${entry.file.name}`
    : entry.file.name
}

function registrationError(entry: Entry) {
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

function parseResponse(response: Response) {
  return response.json().catch(() => ({ error: response.statusText || 'เกิดข้อผิดพลาด' })) as Promise<RegisterSetResponse>
}

export function DocumentSetUploadModal({ mainDoc, onClose, onDone }: Props) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [phase, setPhase] = useState<'intake' | 'confirm' | 'submitting' | 'results'>('intake')
  const [dragOver, setDragOver] = useState(false)
  const [message, setMessage] = useState('')
  const [currentLabel, setCurrentLabel] = useState('')
  const [currentProgress, setCurrentProgress] = useState(0)
  const [overallProgress, setOverallProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const duplicateSequence = useRef(new Map<string, number>())
  const duplicateTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const duplicateRequests = useRef(new Map<string, AbortController>())

  const submitting = phase === 'submitting'
  const registrationCount = entries.filter((entry) => entry.group === 'register').length
  const attachmentCount = entries.length - registrationCount
  const successfulCount = entries.filter((entry) => entry.submitStatus === 'success').length
  const failedCount = entries.filter((entry) => entry.submitStatus === 'failed').length
  const duplicateCodeCounts = new Map<string, number>()
  for (const entry of entries) {
    if (entry.group !== 'register') continue
    const code = entry.code.trim().toUpperCase()
    if (code) duplicateCodeCounts.set(code, (duplicateCodeCounts.get(code) ?? 0) + 1)
  }
  const hasRepeatedCode = Array.from(duplicateCodeCounts.values()).some((count) => count > 1)
  const validationErrors = entries.map(registrationError)
  const canConfirm = entries.length > 0 && !hasRepeatedCode && validationErrors.every((error) => !error)

  function cancelDuplicateWork(id: string) {
    const timer = duplicateTimers.current.get(id)
    if (timer) clearTimeout(timer)
    duplicateTimers.current.delete(id)
    duplicateRequests.current.get(id)?.abort()
    duplicateRequests.current.delete(id)
  }

  function scheduleDuplicateCheck(id: string, rawCode: string, delay = 250) {
    cancelDuplicateWork(id)
    const code = rawCode.trim().toUpperCase()
    const sequence = (duplicateSequence.current.get(id) ?? 0) + 1
    duplicateSequence.current.set(id, sequence)

    if (!code) {
      setEntries((current) => current.map((entry) => (
        entry.id === id ? { ...entry, duplicate: { status: 'idle' }, duplicateChoice: null } : entry
      )))
      return
    }

    setEntries((current) => current.map((entry) => (
      entry.id === id ? { ...entry, duplicate: { status: 'checking' }, duplicateChoice: null } : entry
    )))

    const timer = setTimeout(async () => {
      duplicateTimers.current.delete(id)
      const controller = new AbortController()
      duplicateRequests.current.set(id, controller)
      try {
        const response = await fetch(
          `/api/admin/documents?code=${encodeURIComponent(code)}&pageSize=1`,
          { signal: controller.signal },
        )
        if (!response.ok) throw new Error('ตรวจสอบรหัสเอกสารไม่สำเร็จ กรุณาลองแก้ไขรหัสอีกครั้ง')
        const json = await response.json() as { data?: Document[] }
        const existing = json.data?.[0]
        setEntries((current) => current.map((entry) => {
          if (
            entry.id !== id ||
            entry.code.trim().toUpperCase() !== code ||
            duplicateSequence.current.get(id) !== sequence
          ) return entry
          return {
            ...entry,
            duplicate: existing ? { status: 'found', document: existing } : { status: 'none' },
            duplicateChoice: null,
          }
        }))
      } catch (error) {
        if (controller.signal.aborted) return
        setEntries((current) => current.map((entry) => {
          if (
            entry.id !== id ||
            entry.code.trim().toUpperCase() !== code ||
            duplicateSequence.current.get(id) !== sequence
          ) return entry
          return {
            ...entry,
            duplicate: {
              status: 'error',
              message: error instanceof Error ? error.message : 'ตรวจสอบรหัสเอกสารไม่สำเร็จ',
            },
          }
        }))
      } finally {
        if (duplicateRequests.current.get(id) === controller) duplicateRequests.current.delete(id)
      }
    }, delay)
    duplicateTimers.current.set(id, timer)
  }

  function addFiles(files: File[]) {
    setMessage('')
    const available = MAX_FILES - entries.length
    if (available <= 0) {
      setMessage(`เพิ่มได้สูงสุด ${MAX_FILES} ไฟล์ต่อครั้ง`)
      return
    }
    const accepted = files.slice(0, available)
    const oversized = accepted.filter((file) => file.size > MAX_FILE_SIZE)
    const valid = accepted.filter((file) => file.size <= MAX_FILE_SIZE)
    if (oversized.length > 0) setMessage(`ข้าม ${oversized.length} ไฟล์ที่มีขนาดเกิน 50 MB`)
    if (files.length > accepted.length) {
      setMessage(`เพิ่มได้สูงสุด ${MAX_FILES} ไฟล์ต่อครั้ง ระบบเพิ่มเฉพาะ ${accepted.length} ไฟล์แรก`)
    }
    const additions = valid.map((file) => createEntry(file, mainDoc))
    setEntries((current) => [...current, ...additions])
    for (const entry of additions) {
      if (entry.group === 'register') scheduleDuplicateCheck(entry.id, entry.code, 0)
    }
  }

  function removeEntry(id: string) {
    cancelDuplicateWork(id)
    duplicateSequence.current.delete(id)
    setEntries((current) => current.filter((entry) => entry.id !== id))
  }

  function changeGroup(entry: Entry, group: Group) {
    if (group === entry.group) return
    if (group === 'attach') {
      cancelDuplicateWork(entry.id)
      setEntries((current) => current.map((item) => item.id === entry.id ? {
        ...item,
        group,
        duplicate: { status: 'idle' },
        duplicateChoice: null,
      } : item))
      return
    }

    const code = entry.code || extractFormDocumentCode(entry.file.name) || ''
    setEntries((current) => current.map((item) => item.id === entry.id ? {
      ...item,
      group,
      code,
      title: item.title || extractFormTitle(item.file.name) || withoutExtension(item.file.name),
      type: inferredType(code, mainDoc.type),
      department: deptFromCode(code) ?? mainDoc.department ?? '',
      duplicate: code ? { status: 'checking' } : { status: 'idle' },
      duplicateChoice: null,
    } : item))
    scheduleDuplicateCheck(entry.id, code, 0)
  }

  function updateCode(id: string, rawCode: string) {
    const code = rawCode.toUpperCase()
    setEntries((current) => current.map((entry) => {
      if (entry.id !== id) return entry
      const parsedType = typeFromCode(code)
      const parsedDepartment = deptFromCode(code)
      return {
        ...entry,
        code,
        type: parsedType && (DOC_TYPES as readonly string[]).includes(parsedType) ? parsedType as DocType : entry.type,
        department: parsedDepartment ?? entry.department,
        duplicate: code.trim() ? { status: 'checking' } : { status: 'idle' },
        duplicateChoice: null,
      }
    }))
    scheduleDuplicateCheck(id, code)
  }

  async function uploadEntry(entry: Entry, completed: number, total: number): Promise<UploadedFile> {
    if (entry.uploaded) {
      setCurrentProgress(100)
      setOverallProgress(Math.round(((completed + 1) / total) * 100))
      return entry.uploaded
    }

    const mime = entry.file.type || 'application/octet-stream'
    const presignType = entry.group === 'register' &&
      entry.duplicate.status === 'found' &&
      entry.duplicate.document.status === 'Published'
      ? entry.duplicate.document.type
      : entry.group === 'register' ? entry.type : mainDoc.type
    const params = new URLSearchParams({
      fileName: entry.file.name,
      fileType: mime,
      fileSize: String(entry.file.size),
      type: presignType,
    })
    if (entry.group === 'attach') params.set('kind', 'attachment')
    const response = await fetch(`/api/admin/documents/presign-file?${params}`)
    const presign = await parseResponse(response) as RegisterSetResponse & {
      uploadUrl?: string
      key?: string
      contentType?: string
    }
    if (!response.ok || !presign.uploadUrl || !presign.key) {
      throw new Error(presign.error ?? 'สร้าง URL อัปโหลดไฟล์ไม่สำเร็จ')
    }

    const resolvedMime = presign.contentType || mime
    await uploadFileWithProgress(presign.uploadUrl, entry.file, resolvedMime, (percent) => {
      setCurrentProgress(percent)
      setOverallProgress(Math.round(((completed + percent / 100) / total) * 100))
    })
    const uploaded = {
      key: presign.key,
      name: entry.file.name,
      size: entry.file.size,
      mime: resolvedMime,
    }
    setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, uploaded } : item))
    return uploaded
  }

  function buildPayload(entry: Entry, uploaded: UploadedFile | null): RegisterPayloadItem {
    if (entry.group === 'attach') {
      if (!uploaded) throw new Error('ไม่พบไฟล์ที่อัปโหลด')
      return { kind: 'attach', file: uploaded }
    }
    if (entry.duplicate.status === 'found' && entry.duplicate.document.status === 'Published') {
      if (entry.duplicateChoice === 'link-existing') {
        return { kind: 'link-existing', existing_document_id: entry.duplicate.document.id }
      }
      if (!uploaded) throw new Error('ไม่พบไฟล์ที่อัปโหลด')
      return {
        kind: 'revise-existing',
        existing_document_id: entry.duplicate.document.id,
        file: uploaded,
      }
    }
    if (!uploaded) throw new Error('ไม่พบไฟล์ที่อัปโหลด')
    return {
      kind: 'register',
      file: uploaded,
      document_code: entry.code.trim().toUpperCase(),
      title: entry.title.trim(),
      type: entry.type,
      department: entry.department,
      revision: mainDoc.revision || '1',
      owner_name: mainDoc.owner_name ?? '',
      reviewer_name: mainDoc.reviewer_name ?? '',
      approver_name: mainDoc.approver_name ?? '',
      edit_date: mainDoc.edit_date ?? '',
      effective_date: mainDoc.effective_date ?? '',
      visibility: mainDoc.visibility,
    }
  }

  async function submitEntries(ids: string[]) {
    const selected = entries.filter((entry) => ids.includes(entry.id))
    if (selected.length === 0) return
    setPhase('submitting')
    setMessage('')
    setCurrentProgress(0)
    setOverallProgress(0)
    setEntries((current) => current.map((entry) => ids.includes(entry.id)
      ? { ...entry, submitStatus: null, resultReason: '' }
      : entry))

    const prepared: Array<{ id: string; payload: RegisterPayloadItem }> = []
    const uploadFailures = new Map<string, string>()
    const uploadedById = new Map<string, UploadedFile>()
    let completed = 0

    for (const entry of selected) {
      setCurrentLabel(entryLabel(entry))
      setCurrentProgress(0)
      try {
        const skipsUpload = entry.group === 'register' &&
          entry.duplicate.status === 'found' &&
          entry.duplicate.document.status === 'Published' &&
          entry.duplicateChoice === 'link-existing'
        const uploaded = skipsUpload ? null : await uploadEntry(entry, completed, selected.length)
        if (uploaded) uploadedById.set(entry.id, uploaded)
        prepared.push({ id: entry.id, payload: buildPayload(entry, uploaded) })
      } catch (error) {
        uploadFailures.set(entry.id, error instanceof Error ? error.message : 'อัปโหลดไฟล์ไม่สำเร็จ')
      }
      completed += 1
      setOverallProgress(Math.round((completed / selected.length) * 100))
    }

    const outcomes = new Map<string, { status: 'success' | 'failed'; reason: string }>()
    for (const [id, reason] of uploadFailures) outcomes.set(id, { status: 'failed', reason })

    if (prepared.length > 0) {
      setCurrentLabel('กำลังบันทึกข้อมูลชุดเอกสาร')
      setCurrentProgress(100)
      try {
        const response = await fetch(`/api/admin/documents/${mainDoc.id}/register-set`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: prepared.map((item) => item.payload) }),
        })
        const result = await parseResponse(response)
        if (!response.ok) throw new Error(result.error ?? 'บันทึกชุดเอกสารไม่สำเร็จ')

        for (const success of result.succeeded ?? []) {
          const item = prepared[success.index]
          if (item) outcomes.set(item.id, { status: 'success', reason: '' })
        }
        for (const failure of result.failed ?? []) {
          const item = prepared[failure.index]
          if (item) outcomes.set(item.id, { status: 'failed', reason: failure.error ?? 'บันทึกรายการไม่สำเร็จ' })
        }
        for (const item of prepared) {
          if (!outcomes.has(item.id)) outcomes.set(item.id, { status: 'failed', reason: 'เซิร์ฟเวอร์ไม่ส่งผลลัพธ์ของรายการนี้กลับมา' })
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'บันทึกชุดเอกสารไม่สำเร็จ'
        for (const item of prepared) outcomes.set(item.id, { status: 'failed', reason })
      }
    }

    const nextEntries = entries.map((entry) => {
      const outcome = outcomes.get(entry.id)
      return outcome ? {
        ...entry,
        uploaded: uploadedById.get(entry.id) ?? entry.uploaded,
        submitStatus: outcome.status,
        resultReason: outcome.reason,
      } : entry
    })
    setEntries(nextEntries)
    setPhase('results')
    setCurrentLabel('')
    setCurrentProgress(0)
    setOverallProgress(100)
    if (nextEntries.every((entry) => entry.submitStatus === 'success')) onDone()
  }

  function handleModalClose() {
    if (submitting) return
    if (phase === 'results') onDone()
    else onClose()
  }

  function handleDropZoneKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    inputRef.current?.click()
  }

  return (
    <div
      className="modal-scrim"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === 'Escape') handleModalClose()
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleModalClose()
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, padding: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.5)',
      }}
    >
      <div
        className="modal-panel-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-set-title"
        style={{
          width: '100%', maxWidth: 900, maxHeight: '92vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', background: 'var(--card)',
          borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.25)',
        }}
      >
        <header style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 id="document-set-title" style={{ margin: 0, color: 'var(--ink)', fontSize: 15, fontWeight: 700 }}>
              ลงทะเบียนไฟล์ในชุดเอกสาร
            </h2>
            <div style={{ marginTop: 3, color: 'var(--muted)', fontSize: 11.5 }}>
              เอกสารหลัก: <span style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{mainDoc.document_code}</span> · {mainDoc.title}
            </div>
          </div>
          <button
            type="button"
            aria-label={phase === 'results' ? 'ปิดผลการลงทะเบียน' : 'ยกเลิกและปิดหน้าต่าง'}
            onClick={handleModalClose}
            disabled={submitting}
            style={{ padding: 5, border: 0, background: 'none', color: 'var(--muted)', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? .45 : 1 }}
          >
            <Icon name="x" size={17} />
          </button>
        </header>

        <div style={{ padding: 22, overflowY: 'auto' }}>
          {phase === 'intake' ? (
            <>
              <div
                role="button"
                tabIndex={0}
                aria-label="เลือกไฟล์หลายไฟล์หรือลากไฟล์มาวาง"
                onKeyDown={handleDropZoneKeyDown}
                onClick={() => inputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault()
                  dragCounter.current += 1
                  setDragOver(true)
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault()
                  dragCounter.current = Math.max(0, dragCounter.current - 1)
                  if (dragCounter.current === 0) setDragOver(false)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  dragCounter.current = 0
                  setDragOver(false)
                  addFiles(Array.from(event.dataTransfer.files))
                }}
                style={{
                  padding: '19px 20px', textAlign: 'center', cursor: 'pointer',
                  borderRadius: 10, border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
                  background: dragOver ? 'var(--primary-soft)' : 'var(--surface-2)',
                  transition: 'border-color .12s, background .12s',
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(event) => {
                    addFiles(Array.from(event.target.files ?? []))
                    event.target.value = ''
                  }}
                />
                <Icon name="upload" size={21} style={{ color: dragOver ? 'var(--primary)' : 'var(--muted)' }} />
                <div style={{ marginTop: 5, color: 'var(--ink)', fontSize: 13, fontWeight: 600 }}>
                  {dragOver ? 'ปล่อยไฟล์ที่นี่' : 'เลือกหลายไฟล์ หรือลากไฟล์มาวาง'}
                </div>
                <div style={{ marginTop: 2, color: 'var(--muted)', fontSize: 11 }}>
                  ชื่อขึ้นต้น Fm-, FR-, Rf-, Cf- จะถูกจัดเป็นเอกสารลงทะเบียนอัตโนมัติ · สูงสุด {MAX_FILES} ไฟล์
                </div>
              </div>

              {message ? (
                <div role="alert" style={{ marginTop: 12, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(217,119,6,.25)', background: 'rgba(217,119,6,.08)', color: 'var(--warning)', fontSize: 12 }}>
                  {message}
                </div>
              ) : null}

              {entries.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <div style={{ marginBottom: 9, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ color: 'var(--ink)', fontSize: 12.5, fontWeight: 700 }}>ไฟล์ที่เลือก ({entries.length})</div>
                    <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>
                      ลงทะเบียน {registrationCount} · เอกสารแนบ {attachmentCount}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {entries.map((entry, index) => {
                      const error = validationErrors[index]
                      const repeated = entry.group === 'register' && (duplicateCodeCounts.get(entry.code.trim().toUpperCase()) ?? 0) > 1
                      return (
                        <section key={entry.id} aria-labelledby={`entry-${entry.id}`} style={{ padding: 13, border: `1px solid ${error || repeated ? 'rgba(220,38,38,.3)' : 'var(--border)'}`, borderRadius: 10, background: 'var(--card)' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ minWidth: 0 }}>
                              <div id={`entry-${entry.id}`} title={entry.file.name} style={{ color: 'var(--ink)', fontSize: 12.5, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {entry.file.name}
                              </div>
                              <div style={{ marginTop: 2, color: 'var(--muted)', fontSize: 10.5 }}>{fileSizeLabel(entry.file.size)}</div>
                            </div>
                            <button type="button" aria-label={`นำ ${entry.file.name} ออกจากรายการ`} onClick={() => removeEntry(entry.id)} style={{ flexShrink: 0, padding: 4, border: 0, background: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                              <Icon name="trash" size={15} />
                            </button>
                          </div>

                          <fieldset style={{ margin: '10px 0 0', padding: 0, border: 0, display: 'flex', gap: 14 }}>
                            <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>กลุ่มของ {entry.file.name}</legend>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink)', fontSize: 11.5, cursor: 'pointer' }}>
                              <input type="radio" name={`group-${entry.id}`} checked={entry.group === 'register'} onChange={() => changeGroup(entry, 'register')} />
                              ลงทะเบียนในระบบ
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink)', fontSize: 11.5, cursor: 'pointer' }}>
                              <input type="radio" name={`group-${entry.id}`} checked={entry.group === 'attach'} onChange={() => changeGroup(entry, 'attach')} />
                              ไฟล์อ้างอิงประกอบการพิจารณา (ไม่ลงทะเบียนในระบบ)
                            </label>
                          </fieldset>

                          {entry.group === 'register' ? (
                            <div style={{ marginTop: 11 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 9 }}>
                                <div>
                                  <label htmlFor={`code-${entry.id}`} style={labelStyle}>รหัสเอกสาร</label>
                                  <input id={`code-${entry.id}`} value={entry.code} onChange={(event) => updateCode(entry.id, event.target.value)} style={{ ...inputStyle, fontFamily: 'monospace' }} />
                                </div>
                                <div>
                                  <label htmlFor={`title-${entry.id}`} style={labelStyle}>ชื่อเอกสาร</label>
                                  <input id={`title-${entry.id}`} value={entry.title} onChange={(event) => setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, title: event.target.value } : item))} style={inputStyle} />
                                </div>
                                <div>
                                  <label htmlFor={`type-${entry.id}`} style={labelStyle}>ประเภท</label>
                                  <select id={`type-${entry.id}`} value={entry.type} onChange={(event) => setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, type: event.target.value as DocType } : item))} style={inputStyle}>
                                    {DOC_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                                  </select>
                                </div>
                              </div>

                              <div style={{ marginTop: 9, padding: '8px 10px', borderRadius: 7, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 10.8, lineHeight: 1.6 }}>
                                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>ข้อมูลที่ใช้ร่วมกับเอกสารหลัก:</span>{' '}
                                หน่วยงาน {entry.department || '—'} · Rev. {mainDoc.revision || '1'} · ผู้จัดทำ {mainDoc.owner_name || '—'} · ผู้ทบทวน {mainDoc.reviewer_name || '—'} · ผู้อนุมัติ {mainDoc.approver_name || '—'} · วันที่แก้ไข {mainDoc.edit_date || '—'} · วันที่มีผล {mainDoc.effective_date || '—'} · {mainDoc.visibility}
                              </div>

                              {entry.duplicate.status === 'checking' ? (
                                <div role="status" style={{ marginTop: 7, color: 'var(--muted)', fontSize: 11 }}>กำลังตรวจสอบรหัสเอกสาร…</div>
                              ) : null}
                              {entry.duplicate.status === 'none' ? (
                                <div role="status" style={{ marginTop: 7, color: 'var(--success)', fontSize: 11 }}>ไม่พบรหัสซ้ำ พร้อมลงทะเบียนเอกสารใหม่</div>
                              ) : null}
                              {entry.duplicate.status === 'found' && entry.duplicate.document.status === 'Published' ? (
                                <fieldset style={{ margin: '9px 0 0', padding: '9px 10px', borderRadius: 8, border: '1px solid rgba(217,119,6,.28)', background: 'rgba(217,119,6,.07)' }}>
                                  <legend style={{ padding: '0 4px', color: 'var(--warning)', fontSize: 11.5, fontWeight: 650 }}>
                                    พบเอกสาร Published: {entry.duplicate.document.document_code} Rev. {entry.duplicate.document.revision}
                                  </legend>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink)', fontSize: 11.5, cursor: 'pointer' }}>
                                      <input type="radio" name={`duplicate-${entry.id}`} checked={entry.duplicateChoice === 'link-existing'} onChange={() => setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, duplicateChoice: 'link-existing' } : item))} />
                                      ลิงก์เอกสารเดิม (ไม่อัปโหลดไฟล์นี้)
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink)', fontSize: 11.5, cursor: 'pointer' }}>
                                      <input type="radio" name={`duplicate-${entry.id}`} checked={entry.duplicateChoice === 'revise-existing'} onChange={() => setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, duplicateChoice: 'revise-existing' } : item))} />
                                      เปิดปรับปรุง Rev+
                                    </label>
                                  </div>
                                </fieldset>
                              ) : null}
                              {error || repeated ? (
                                <div role="alert" style={{ marginTop: 7, color: 'var(--danger)', fontSize: 11 }}>
                                  {repeated ? 'มีรหัสนี้ซ้ำกันมากกว่าหนึ่งรายการในชุดที่เลือก' : error}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </section>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {phase === 'confirm' ? (
            <div>
              <div style={{ padding: '12px 14px', borderRadius: 9, background: 'var(--primary-soft)', color: 'var(--ink)', fontSize: 12.5 }}>
                กรุณาตรวจสอบก่อนเริ่มอัปโหลด การดำเนินการนี้จะลงทะเบียน {registrationCount} รายการ และแนบไฟล์อ้างอิง {attachmentCount} รายการกับเอกสารหลัก
              </div>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {entries.map((entry) => {
                  const action = entry.group === 'attach'
                    ? 'ไฟล์อ้างอิงประกอบการพิจารณา'
                    : entry.duplicate.status === 'found'
                      ? entry.duplicateChoice === 'link-existing' ? 'ลิงก์เอกสารเดิม' : 'เปิดปรับปรุง Rev+'
                      : 'ลงทะเบียนเอกสารใหม่'
                  return (
                    <div key={entry.id} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'var(--ink)', fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entryLabel(entry)}</div>
                        <div style={{ marginTop: 2, color: 'var(--muted)', fontSize: 10.8 }}>{entry.group === 'register' ? `${entry.type} · ${entry.department || 'ไม่ระบุหน่วยงาน'}` : fileSizeLabel(entry.file.size)}</div>
                      </div>
                      <div style={{ flexShrink: 0, padding: '4px 8px', borderRadius: 99, background: entry.group === 'register' ? 'var(--primary-soft)' : 'var(--surface-2)', color: entry.group === 'register' ? 'var(--primary)' : 'var(--muted)', fontSize: 10.8, fontWeight: 600 }}>{action}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          {phase === 'submitting' ? (
            <div aria-live="polite" style={{ padding: '34px 12px', textAlign: 'center' }}>
              <div style={{ color: 'var(--ink)', fontSize: 14, fontWeight: 700 }}>กำลังดำเนินการทีละไฟล์</div>
              <div style={{ marginTop: 5, color: 'var(--muted)', fontSize: 12, wordBreak: 'break-word' }}>{currentLabel || 'กำลังเตรียมรายการ…'}</div>
              <div style={{ maxWidth: 560, margin: '22px auto 0', textAlign: 'left' }}>
                <div style={{ marginBottom: 5, display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 11 }}><span>ไฟล์ปัจจุบัน</span><span>{currentProgress}%</span></div>
                <div role="progressbar" aria-label="ความคืบหน้าไฟล์ปัจจุบัน" aria-valuemin={0} aria-valuemax={100} aria-valuenow={currentProgress} style={{ height: 7, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ width: `${currentProgress}%`, height: '100%', borderRadius: 99, background: 'var(--primary)', transition: 'width .12s' }} />
                </div>
                <div style={{ margin: '15px 0 5px', display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 11 }}><span>ทั้งหมด</span><span>{overallProgress}%</span></div>
                <div role="progressbar" aria-label="ความคืบหน้าทั้งหมด" aria-valuemin={0} aria-valuemax={100} aria-valuenow={overallProgress} style={{ height: 7, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ width: `${overallProgress}%`, height: '100%', borderRadius: 99, background: 'var(--success)', transition: 'width .12s' }} />
                </div>
              </div>
              <div style={{ marginTop: 18, color: 'var(--warning)', fontSize: 11.5 }}>กรุณาอย่าปิดหน้าต่างระหว่างอัปโหลดและบันทึกข้อมูล</div>
            </div>
          ) : null}

          {phase === 'results' ? (
            <div>
              <div aria-live="polite" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: 12, borderRadius: 9, background: 'rgba(22,163,74,.09)', color: 'var(--success)', fontSize: 12.5, fontWeight: 700 }}>สำเร็จ {successfulCount} รายการ</div>
                <div style={{ padding: 12, borderRadius: 9, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', fontSize: 12.5, fontWeight: 700 }}>ไม่สำเร็จ {failedCount} รายการ</div>
              </div>
              <div style={{ marginTop: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {entries.map((entry) => (
                  <div key={entry.id} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                    <Icon name={entry.submitStatus === 'success' ? 'check' : 'alert'} size={16} style={{ marginTop: 1, flexShrink: 0, color: entry.submitStatus === 'success' ? 'var(--success)' : 'var(--danger)' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'var(--ink)', fontSize: 12.3, fontWeight: 600, wordBreak: 'break-word' }}>{entryLabel(entry)}</div>
                      <div style={{ marginTop: 2, color: entry.submitStatus === 'success' ? 'var(--success)' : 'var(--danger)', fontSize: 11 }}>
                        {entry.submitStatus === 'success' ? 'ดำเนินการสำเร็จ' : entry.resultReason || 'ดำเนินการไม่สำเร็จ'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {failedCount > 0 ? (
                <div style={{ marginTop: 12, color: 'var(--muted)', fontSize: 11.5 }}>
                  ระบบจะใช้ไฟล์ที่อัปโหลดขึ้น R2 สำเร็จแล้วซ้ำในการลองใหม่ และจะไม่สร้างรายการที่สำเร็จไปแล้วอีกครั้ง
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer style={{ padding: '13px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ color: 'var(--muted)', fontSize: 11 }}>
            {phase === 'intake' ? `${entries.length}/${MAX_FILES} ไฟล์` : phase === 'results' ? `สำเร็จ ${successfulCount} · ไม่สำเร็จ ${failedCount}` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {phase === 'intake' ? (
              <>
                <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
                <Button variant="primary" onClick={() => setPhase('confirm')} disabled={!canConfirm}>ตรวจสอบและยืนยัน</Button>
              </>
            ) : null}
            {phase === 'confirm' ? (
              <>
                <Button variant="secondary" onClick={() => setPhase('intake')}>ย้อนกลับ</Button>
                <Button variant="primary" onClick={() => void submitEntries(entries.map((entry) => entry.id))}>ยืนยันและเริ่มอัปโหลด</Button>
              </>
            ) : null}
            {phase === 'submitting' ? <Button variant="secondary" disabled>กำลังดำเนินการ…</Button> : null}
            {phase === 'results' ? (
              <>
                {failedCount > 0 ? (
                  <Button variant="secondary" onClick={() => void submitEntries(entries.filter((entry) => entry.submitStatus === 'failed').map((entry) => entry.id))}>
                    ลองใหม่เฉพาะรายการไม่สำเร็จ
                  </Button>
                ) : null}
                <Button variant="primary" onClick={onDone}>ปิด</Button>
              </>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  )
}
