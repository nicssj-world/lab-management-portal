'use client'

import { useEffect, useRef, useState } from 'react'
import { deptFromCode, extractFormDocumentCode, extractFormTitle, typeFromCode } from '@/lib/documents/code-parse'
import { uploadFileWithProgress } from '@/lib/documents/upload-with-progress'
import { DOC_TYPES } from '@/lib/validations/document'
import type { Document } from '@/lib/supabase/types'
import {
  MAX_FILES,
  MAX_FILE_SIZE,
  createUploadEntry,
  entryLabel,
  failedEntryIds,
  inferredType,
  mapRegisterSetOutcomes,
  parseRegisterSetResponse,
  registrationError,
  retainedUpload,
  type DocType,
  type DuplicateChoice,
  type Group,
  type RegisterPayloadItem,
  type RegisterSetResponse,
  type UploadedFile,
  type UploadEntry,
  type UploadPhase,
} from './document-set-upload-model'

export function useDocumentSetUpload(mainDoc: Document, onDone: () => void) {
  const [entries, setEntries] = useState<UploadEntry[]>([])
  const [phase, setPhase] = useState<UploadPhase>('intake')
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
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      for (const timer of duplicateTimers.current.values()) clearTimeout(timer)
      duplicateTimers.current.clear()
      for (const controller of duplicateRequests.current.values()) controller.abort()
      duplicateRequests.current.clear()
      duplicateSequence.current.clear()
    }
  }, [])

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
  const validationErrors = entries.map(registrationError)
  const hasRepeatedCode = Array.from(duplicateCodeCounts.values()).some((count) => count > 1)
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
      setEntries((current) => current.map((entry) => entry.id === id
        ? { ...entry, duplicate: { status: 'idle' }, duplicateChoice: null }
        : entry))
      return
    }

    setEntries((current) => current.map((entry) => entry.id === id
      ? { ...entry, duplicate: { status: 'checking' }, duplicateChoice: null }
      : entry))
    const timer = setTimeout(async () => {
      duplicateTimers.current.delete(id)
      const controller = new AbortController()
      duplicateRequests.current.set(id, controller)
      try {
        const response = await fetch(`/api/admin/documents?code=${encodeURIComponent(code)}&pageSize=1`, { signal: controller.signal })
        if (!response.ok) throw new Error('ตรวจสอบรหัสเอกสารไม่สำเร็จ กรุณาลองแก้ไขรหัสอีกครั้ง')
        const json = await response.json() as { data?: Document[] }
        const existing = json.data?.[0]
        if (!mounted.current) return
        setEntries((current) => current.map((entry) => {
          if (entry.id !== id || entry.code.trim().toUpperCase() !== code || duplicateSequence.current.get(id) !== sequence) return entry
          return { ...entry, duplicate: existing ? { status: 'found', document: existing } : { status: 'none' }, duplicateChoice: null }
        }))
      } catch (error) {
        if (controller.signal.aborted || !mounted.current) return
        setEntries((current) => current.map((entry) => {
          if (entry.id !== id || entry.code.trim().toUpperCase() !== code || duplicateSequence.current.get(id) !== sequence) return entry
          return {
            ...entry,
            duplicate: { status: 'error', message: error instanceof Error ? error.message : 'ตรวจสอบรหัสเอกสารไม่สำเร็จ' },
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
    if (files.length > accepted.length) setMessage(`เพิ่มได้สูงสุด ${MAX_FILES} ไฟล์ต่อครั้ง ระบบเพิ่มเฉพาะ ${accepted.length} ไฟล์แรก`)
    const additions = valid.map((file) => createUploadEntry(file, mainDoc))
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

  function changeGroup(entry: UploadEntry, group: Group) {
    if (group === entry.group) return
    if (group === 'attach') {
      cancelDuplicateWork(entry.id)
      setEntries((current) => current.map((item) => item.id === entry.id
        ? { ...item, group, duplicate: { status: 'idle' }, duplicateChoice: null }
        : item))
      return
    }
    const code = entry.code || extractFormDocumentCode(entry.file.name) || ''
    setEntries((current) => current.map((item) => item.id === entry.id ? {
      ...item,
      group,
      code,
      title: item.title || extractFormTitle(item.file.name) || item.file.name.replace(/\.[^.]+$/, ''),
      type: inferredType(code, mainDoc.type),
      department: mainDoc.department ?? deptFromCode(code) ?? '',
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
      return {
        ...entry,
        code,
        type: parsedType && (DOC_TYPES as readonly string[]).includes(parsedType) ? parsedType as DocType : entry.type,
        department: mainDoc.department ?? deptFromCode(code) ?? entry.department,
        duplicate: code.trim() ? { status: 'checking' } : { status: 'idle' },
        duplicateChoice: null,
      }
    }))
    scheduleDuplicateCheck(id, code)
  }

  function updateTitle(id: string, title: string) {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, title } : entry))
  }

  function updateType(id: string, type: DocType) {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, type } : entry))
  }

  function chooseDuplicate(id: string, duplicateChoice: DuplicateChoice) {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, duplicateChoice } : entry))
  }

  function dragEnter() {
    dragCounter.current += 1
    setDragOver(true)
  }

  function dragLeave() {
    dragCounter.current = Math.max(0, dragCounter.current - 1)
    if (dragCounter.current === 0) setDragOver(false)
  }

  function resetDrag() {
    dragCounter.current = 0
    setDragOver(false)
  }

  async function uploadEntry(entry: UploadEntry, completed: number, total: number): Promise<UploadedFile> {
    if (entry.uploaded) {
      setCurrentProgress(100)
      setOverallProgress(Math.round(((completed + 1) / total) * 100))
      return entry.uploaded
    }
    const mime = entry.file.type || 'application/octet-stream'
    const presignType = entry.group === 'register' && entry.duplicate.status === 'found' && entry.duplicate.document.status === 'Published'
      ? entry.duplicate.document.type
      : entry.group === 'register' ? entry.type : mainDoc.type
    const setItemKind = entry.group === 'attach'
      ? 'attach'
      : entry.duplicate.status === 'found' && entry.duplicateChoice === 'revise-existing'
        ? 'revise-existing'
        : 'register'
    const params = new URLSearchParams({
      fileName: entry.file.name,
      fileType: mime,
      fileSize: String(entry.file.size),
      type: presignType,
      mainDocumentId: mainDoc.id,
      setItemKind,
    })
    const response = await fetch(`/api/admin/documents/presign-file?${params}`)
    const presign = await parseRegisterSetResponse(response) as RegisterSetResponse & { uploadUrl?: string; uploadId?: string; key?: string; contentType?: string }
    if (!response.ok || !presign.uploadUrl || !presign.uploadId || !presign.key) throw new Error(presign.error ?? 'สร้าง URL อัปโหลดไฟล์ไม่สำเร็จ')
    const resolvedMime = presign.contentType || mime
    await uploadFileWithProgress(presign.uploadUrl, entry.file, resolvedMime, (percent) => {
      if (!mounted.current) return
      setCurrentProgress(percent)
      setOverallProgress(Math.round(((completed + percent / 100) / total) * 100))
    })
    const uploaded = { upload_id: presign.uploadId, key: presign.key, name: entry.file.name, size: entry.file.size, mime: resolvedMime }
    if (mounted.current) setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, uploaded } : item))
    return uploaded
  }

  function buildPayload(entry: UploadEntry, uploaded: UploadedFile | null): RegisterPayloadItem {
    if (entry.group === 'attach') {
      if (!uploaded) throw new Error('ไม่พบไฟล์ที่อัปโหลด')
      return { kind: 'attach', file: uploaded }
    }
    if (entry.duplicate.status === 'found' && entry.duplicate.document.status === 'Published') {
      if (entry.duplicateChoice === 'link-existing') return { kind: 'link-existing', existing_document_id: entry.duplicate.document.id }
      if (!uploaded) throw new Error('ไม่พบไฟล์ที่อัปโหลด')
      return { kind: 'revise-existing', existing_document_id: entry.duplicate.document.id, file: uploaded }
    }
    if (!uploaded) throw new Error('ไม่พบไฟล์ที่อัปโหลด')
    return {
      kind: 'register', file: uploaded, document_code: entry.code.trim().toUpperCase(), title: entry.title.trim(),
      type: entry.type, department: entry.department, revision: mainDoc.revision || '1', owner_name: mainDoc.owner_name ?? '',
      reviewer_name: mainDoc.reviewer_name ?? '', approver_name: mainDoc.approver_name ?? '', edit_date: mainDoc.edit_date ?? '',
      effective_date: mainDoc.effective_date ?? '', visibility: mainDoc.visibility,
    }
  }

  async function submitEntries(ids: string[]) {
    const selected = entries.filter((entry) => ids.includes(entry.id))
    if (selected.length === 0) return
    setPhase('submitting')
    setMessage('')
    setCurrentProgress(0)
    setOverallProgress(0)
    setEntries((current) => current.map((entry) => ids.includes(entry.id) ? { ...entry, submitStatus: null, resultReason: '' } : entry))
    const prepared: Array<{ id: string; payload: RegisterPayloadItem }> = []
    const uploadFailures = new Map<string, string>()
    const uploadedById = new Map<string, UploadedFile>()
    let completed = 0
    for (const entry of selected) {
      setCurrentLabel(entryLabel(entry))
      setCurrentProgress(0)
      try {
        const skipsUpload = entry.group === 'register' && entry.duplicate.status === 'found'
          && entry.duplicate.document.status === 'Published' && entry.duplicateChoice === 'link-existing'
        const uploaded = skipsUpload ? null : await uploadEntry(entry, completed, selected.length)
        if (uploaded) uploadedById.set(entry.id, uploaded)
        prepared.push({ id: entry.id, payload: buildPayload(entry, uploaded) })
      } catch (error) {
        uploadFailures.set(entry.id, error instanceof Error ? error.message : 'อัปโหลดไฟล์ไม่สำเร็จ')
      }
      completed += 1
      if (mounted.current) setOverallProgress(Math.round((completed / selected.length) * 100))
    }
    const outcomes = new Map<string, { status: 'success' | 'failed'; reason: string }>()
    for (const [id, reason] of uploadFailures) outcomes.set(id, { status: 'failed', reason })
    if (prepared.length > 0) {
      setCurrentLabel('กำลังบันทึกข้อมูลชุดเอกสาร')
      setCurrentProgress(100)
      try {
        const response = await fetch(`/api/admin/documents/${mainDoc.id}/register-set`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: prepared.map((item) => item.payload) }),
        })
        const result = await parseRegisterSetResponse(response)
        if (!response.ok) throw new Error(result.error ?? 'บันทึกชุดเอกสารไม่สำเร็จ')
        for (const [id, outcome] of mapRegisterSetOutcomes(prepared.map((item) => item.id), result)) outcomes.set(id, outcome)
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'บันทึกชุดเอกสารไม่สำเร็จ'
        for (const item of prepared) outcomes.set(item.id, { status: 'failed', reason })
      }
    }
    if (!mounted.current) return
    const nextEntries = entries.map((entry) => {
      const outcome = outcomes.get(entry.id)
      return outcome ? { ...entry, uploaded: retainedUpload(uploadedById.get(entry.id), entry.uploaded), submitStatus: outcome.status, resultReason: outcome.reason } : entry
    })
    setEntries(nextEntries)
    setPhase('results')
    setCurrentLabel('')
    setCurrentProgress(0)
    setOverallProgress(100)
    if (nextEntries.every((entry) => entry.submitStatus === 'success')) onDone()
  }

  return {
    entries, phase, submitting, dragOver, message, currentLabel, currentProgress, overallProgress, inputRef,
    registrationCount, attachmentCount, successfulCount, failedCount, duplicateCodeCounts, validationErrors, canConfirm,
    addFiles, removeEntry, changeGroup, updateCode, updateTitle, updateType, chooseDuplicate,
    dragEnter, dragLeave, resetDrag,
    showConfirm: () => setPhase('confirm'),
    showIntake: () => setPhase('intake'),
    submitAll: () => void submitEntries(entries.map((entry) => entry.id)),
    retryFailed: () => void submitEntries(failedEntryIds(entries)),
  }
}

export type DocumentSetUploadController = ReturnType<typeof useDocumentSetUpload>
