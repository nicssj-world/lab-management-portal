'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { DOC_TYPES, DOC_VISIBILITIES } from '@/lib/validations/document'
import type { Document } from '@/lib/supabase/types'

interface Props {
  doc?: Document | null
  userRole?: string
  docRole?: string
  onClose: () => void
  onSaved: (doc: Document) => void
  onDuplicateOpen?: (documentId: string) => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', fontSize: 13,
  fontFamily: 'inherit', color: 'var(--ink)',
  background: 'var(--card)', outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block',
}

function RequiredMark() {
  return <span style={{ color: 'var(--danger)' }}> *</span>
}

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function todayIsoDate(): string {
  return new Date().toISOString().split('T')[0]
}

function requiresCover(type: string): boolean {
  return type === 'QP' || type === 'WI'
}

function isOfficialFileAllowed(type: string, file: File): boolean {
  if (requiresCover(type)) return file.name.match(/\.pdf$/i) !== null || file.type === 'application/pdf'
  return file.name.match(/\.(pdf|doc|docx|xls|xlsx)$/i) !== null
}

async function readJsonOrError(res: Response): Promise<{ error?: string; [key: string]: unknown }> {
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return await res.json()

  const text = (await res.text()).trim()
  if (/request entity too large|body exceeded|payload too large/i.test(text)) {
    return { error: 'ไฟล์ใหญ่เกินขนาดที่ระบบอ่านอัตโนมัติได้ กรุณาลดขนาดไฟล์หรือกรอกข้อมูลเอง' }
  }
  return { error: text || res.statusText || 'เกิดข้อผิดพลาด' }
}

function uploadFileWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve()
        return
      }
      reject(new Error(`(${xhr.status}) ${xhr.responseText.slice(0, 160)}`))
    }
    xhr.onerror = () => reject(new Error('network error'))
    xhr.send(file)
  })
}

const DEPT_BY_PREFIX: Record<string, string> = {
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

const TYPE_BY_PREFIX: Record<string, string> = {
  QP: 'QP', WI: 'WI',
  QM: 'Manual', MN: 'Manual',
  FM: 'Form', FR: 'Form',
  PL: 'Policy', PO: 'Policy',
  RC: 'Record', RD: 'Record',
  RF: 'Reference',
  CF: 'Card file',
}

function typeFromCode(code: string): string | null {
  const first = code.split('-')[0]?.toUpperCase() ?? ''
  if (DOC_TYPES.includes(first as typeof DOC_TYPES[number])) return first
  return TYPE_BY_PREFIX[first] ?? null
}

function deptFromCode(code: string): string | null {
  for (const seg of code.split('-')) {
    const prefix = seg.match(/^([A-Z]{2})/)?.[1] ?? ''
    if (DEPT_BY_PREFIX[prefix]) return DEPT_BY_PREFIX[prefix]
  }
  return null
}

function isFormFile(filename: string): boolean {
  return /^(?:Fm|FR|Rf|Cf)-/i.test(filename)
}

function extractFormDocumentCode(filename: string): string | null {
  // "Fm-QP-LAB-03-05 แบบบันทึก....pdf" → "FM-QP-LAB-03-05"
  const m = filename.match(/^([^\s.]+)/)
  return m ? m[1].toUpperCase() : null
}

function extractFormTitle(filename: string): string | null {
  // "Fm-QP-LAB-03-05 แบบบันทึก....pdf" → "แบบบันทึก...."
  const withoutExt = filename.replace(/\.[^.]+$/, '')
  const spaceIdx = withoutExt.indexOf(' ')
  if (spaceIdx === -1) return null
  return withoutExt.slice(spaceIdx + 1).trim() || null
}

function extractParentCode(filename: string): string | null {
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

function revisionNumber(v: string): number | null {
  const n = Number(v.trim())
  return Number.isFinite(n) ? n : null
}

function revisionOrderNumber(v: string): number | null {
  const trimmed = v.trim()
  const direct = Number(trimmed)
  if (Number.isFinite(direct)) return direct
  const m = trimmed.match(/(\d+)/)
  if (!m) return null
  const parsed = Number(m[1])
  return Number.isFinite(parsed) ? parsed : null
}

function stripThaiTitle(name: string): string {
  return name
    .replace(/^(นาย|นางสาว|นาง|ดร\.|นพ\.|พญ\.|ภก\.|ภญ\.)\s*/g, '')
    .trim()
}

const THAI_MONTHS: Record<string, number> = {
  'มกราคม': 1,   'ม.ค.': 1,  'ม.ค': 1,
  'กุมภาพันธ์': 2, 'ก.พ.': 2, 'ก.พ': 2,
  'มีนาคม': 3,   'มี.ค.': 3, 'มี.ค': 3,
  'เมษายน': 4,   'เม.ย.': 4, 'เม.ย': 4,
  'พฤษภาคม': 5,  'พ.ค.': 5,  'พ.ค': 5,
  'มิถุนายน': 6,  'มิ.ย.': 6, 'มิ.ย': 6,
  'กรกฎาคม': 7,  'ก.ค.': 7,  'ก.ค': 7,
  'สิงหาคม': 8,   'ส.ค.': 8,  'ส.ค': 8,
  'กันยายน': 9,  'ก.ย.': 9,  'ก.ย': 9,
  'ตุลาคม': 10,  'ต.ค.': 10, 'ต.ค': 10,
  'พฤศจิกายน': 11, 'พ.ย.': 11, 'พ.ย': 11,
  'ธันวาคม': 12,  'ธ.ค.': 12, 'ธ.ค': 12,
}

function parseThaiDate(raw: string): string | null {
  if (!raw || /click|tap/i.test(raw)) return null
  // dd/mm/yyyy or dd-mm-yyyy
  const numM = raw.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/)
  if (numM) {
    const d = Number(numM[1]), mo = Number(numM[2])
    let y = Number(numM[3])
    if (y > 2500) y -= 543
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  // "14 พฤษภาคม 2568" or "14 พ.ค. 2568"
  for (const [name, num] of Object.entries(THAI_MONTHS)) {
    const escaped = name.replace(/\./g, '\\.')
    const thaiM = raw.match(new RegExp(`(\\d{1,2})\\s+${escaped}\\s+(\\d{4})`))
    if (thaiM) {
      let y = Number(thaiM[2])
      if (y > 2500) y -= 543
      return `${y}-${String(num).padStart(2, '0')}-${String(Number(thaiM[1])).padStart(2, '0')}`
    }
  }
  return null
}

// Find a date in the text within ~150 chars after a label keyword (handles label+value on separate lines)
function findDateNear(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const idx = text.indexOf(label)
    if (idx === -1) continue
    const nearby = text.slice(idx + label.length, idx + label.length + 150)
    const parsed = parseThaiDate(nearby)
    if (parsed) return parsed
  }
  return null
}

function normalizeExtractedWhitespace(value: string): string {
  return value
    .replace(/([\u0E00-\u0E7F])[\t ]*[\r\n]+[\t ]*([\u0E00-\u0E7F])/g, '$1$2')
    .replace(/[\t ]*[\r\n]+[\t ]*/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function cleanExtractedField(value: string, stopLabels: string[] = []): string {
  let cleaned = normalizeExtractedWhitespace(value)
  for (const label of stopLabels) {
    const idx = cleaned.search(new RegExp(`\\s*${label}\\s*:`, 'i'))
    if (idx !== -1) cleaned = cleaned.slice(0, idx).trim()
  }
  return cleaned
}

function parseExtractedText(text: string) {
  const stopLabelPattern = [
    'หมายเลขเอกสาร',
    'Document\\s+No\\.?',
    'วันที่ประกาศใช้เอกสาร',
    'Issue\\s+Date',
    'วันที่แก้ไขเอกสาร',
    'Edit\\s+Date',
    'วันที่ทบทวน',
    'Review\\s+Date',
    'วันที่บังคับใช้เอกสาร',
    'Effective\\s+Date',
    'หน้า\\/จำนวนหน้า',
    'Page\\s+No\\.?',
    'ผู้เกี่ยวข้อง',
    'แก้ไขครั้งที่',
    'ครั้งที่แก้ไข',
    'Revision',
    'จัดทำโดย',
    'รับรองโดย',
    'อนุมัติโดย',
  ].join('|')

  const get = (patterns: RegExp[], stopLabels: string[] = []): string | undefined => {
    for (const re of patterns) {
      const m = text.match(re)
      if (m?.[1] && !m[1].includes('{')) {
        const cleaned = cleanExtractedField(m[1], stopLabels)
        if (cleaned) return cleaned
      }
    }
    return undefined
  }

  const ownerRaw   = get([/จัดทำโดย\s*:\s*([^\n\r{][^\n\r]+)/])
  const reviewRaw  = get([/รับรองโดย\s*:\s*([^\n\r{][^\n\r]+)/])
  const approveRaw = get([/อนุมัติโดย\s*:\s*([^\n\r{][^\n\r]+)/])

  return {
    title:         get([
      new RegExp(`(?:เรื่อง|ชื่อเอกสาร)\\s*:\\s*([^\\r\\n{][\\s\\S]*?)(?=\\s*(?:${stopLabelPattern})\\s*:|$)`, 'i'),
      /(?:เรื่อง|ชื่อเอกสาร)\s*:\s*([^\n\r{][^\n\r]+)/,
    ], stopLabelPattern.split('|')),
    documentCode:  get([/(?:หมายเลขเอกสาร|Document\s+No\.?)\s*:\s*([^\n\r{]+)/], ['หน้า\\/จำนวนหน้า', 'Page\\s+No\\.?', 'วันที่']),
    revision:      get([/(?:แก้ไขครั้งที่|ครั้งที่แก้ไข|Revision)\s*:\s*([^\n\r{]+)/], ['หมายเลขเอกสาร', 'Document\\s+No\\.?']),
    ownerName:     ownerRaw   ? stripThaiTitle(ownerRaw)   : undefined,
    reviewerName:  reviewRaw  ? stripThaiTitle(reviewRaw)  : undefined,
    approverName:  approveRaw ? stripThaiTitle(approveRaw) : undefined,
    editDate:      findDateNear(text, ['วันที่แก้ไขเอกสาร', 'วันที่แก้ไข', 'Edit Date', 'Edit\xa0Date'])
      ?? findDateNear(text, ['วันที่ทบทวน', 'Review Date', 'Review\xa0Date']),
    effectiveDate: findDateNear(text, ['วันที่บังคับใช้เอกสาร', 'วันที่บังคับใช้', 'Effective Date', 'Effective\xa0Date']),
  }
}

export function DocumentUploadModal({ doc, userRole, docRole, onClose, onSaved, onDuplicateOpen }: Props) {
  const isEdit = !!doc
  const isPublishedCorrection = isEdit && doc?.status === 'Published'
  const canImportCurrent = !isEdit && (userRole === 'Admin' || userRole === 'Document Controller' || docRole === 'Document Controller')
  const [createMode, setCreateMode] = useState<'draft' | 'import-current'>('draft')
  const isImportCurrent = canImportCurrent && createMode === 'import-current'
  const availableStatuses = isEdit ? [doc?.status ?? 'Draft'] : (isImportCurrent ? ['Published'] : ['Draft'])
  const fileRef = useRef<HTMLInputElement>(null)
  const wordFileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [wordDragOver, setWordDragOver] = useState(false)
  const dragCounter = useRef(0)
  const wordDragCounter = useRef(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedWordFile, setSelectedWordFile] = useState<File | null>(null)
  const [saveRevision, setSaveRevision] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractingWord, setExtractingWord] = useState(false)
  const [error, setError] = useState('')
  const [duplicateDocumentId, setDuplicateDocumentId] = useState<string | null>(null)
  const [coverDetailsOpen, setCoverDetailsOpen] = useState(isEdit)

  const [title, setTitle]               = useState(doc?.title ?? '')
  const [documentCode, setDocumentCode] = useState(doc?.document_code ?? '')
  const [type, setType]                 = useState<string>(doc?.type ?? 'QP')
  const [visibility, setVisibility]     = useState<string>(doc?.visibility ?? 'Internal')
  const status                          = isImportCurrent ? 'Published' : (doc?.status ?? 'Draft')
  const [revision, setRevision]         = useState(doc?.revision ?? '1')
  const [legacyCoverIncluded, setLegacyCoverIncluded] = useState(true)
  const [importedCurrentNote, setImportedCurrentNote] = useState('')
  const [ownerName, setOwnerName]       = useState(doc?.owner_name ?? '')
  const [reviewerName, setReviewerName] = useState(doc?.reviewer_name ?? '')
  const [approverName, setApproverName] = useState(doc?.approver_name ?? '')
  const [department, setDepartment]     = useState(doc?.department ?? '')
  const [editDate, setEditDate]         = useState(doc?.edit_date ?? doc?.expiry_date ?? '')
  const [effectiveDate, setEffectiveDate] = useState(doc?.effective_date ?? '')
  const [obsoleteDate, setObsoleteDate] = useState(doc?.obsolete_date ?? '')
  const [obsoleteReason, setObsoleteReason] = useState(doc?.obsolete_reason ?? '')
  const [description, setDescription]   = useState(doc?.description ?? '')

  const isObsolete = status === 'Obsolete'
  const originalRevision = doc?.revision ?? '1'
  const originalRevisionNumber = revisionNumber(originalRevision)
  const currentRevisionNumber = revisionNumber(revision)
  const revisionChanged = isEdit && revision.trim() !== originalRevision.trim()
  const revisionMustIncrease = revisionChanged
    && originalRevisionNumber !== null
    && (currentRevisionNumber === null || currentRevisionNumber <= originalRevisionNumber)
  const revisionWarning = revisionMustIncrease
    ? `Revision ใหม่ต้องเป็นตัวเลขที่สูงกว่า Rev. ${originalRevision}`
    : ''
  const lockedInputStyle: React.CSSProperties = {
    ...inputStyle,
    opacity: 0.72,
    cursor: 'not-allowed',
    background: 'var(--surface-2)',
  }

  const handleFile = useCallback((file: File) => {
    if (!isOfficialFileAllowed(type, file)) {
      setError(requiresCover(type)
        ? 'QP/WI ต้องใช้ไฟล์ PDF เนื้อหาในช่องไฟล์ทางการ'
        : 'ช่องไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('ไฟล์ต้องไม่เกิน 50 MB')
      return
    }
    setError('')
    setSelectedFile(file)
  }, [type])

  const handleWordFile = useCallback((file: File) => {
    if (!file.name.match(/\.(doc|docx|xlsx)$/i)) {
      setError('ช่องนี้รองรับเฉพาะไฟล์ DOC, DOCX, XLSX เท่านั้น')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('ไฟล์ต้องไม่เกิน 50 MB')
      return
    }
    setError('')
    setSelectedWordFile(file)
    setEditDate((current) => current || todayIsoDate())
  }, [])

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current += 1
    setDragOver(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current -= 1
    if (dragCounter.current === 0) setDragOver(false)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onWordDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    wordDragCounter.current += 1
    setWordDragOver(true)
  }, [])

  const onWordDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    wordDragCounter.current -= 1
    if (wordDragCounter.current === 0) setWordDragOver(false)
  }, [])

  const onWordDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    wordDragCounter.current = 0
    setWordDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleWordFile(file)
  }, [handleWordFile])

  async function extractFromFile() {
    if (!selectedFile) return
    setExtracting(true)
    setError('')
    try {
      if (isFormFile(selectedFile.name)) {
        const formCode = extractFormDocumentCode(selectedFile.name)
        const formTitle = extractFormTitle(selectedFile.name)
        if (formCode) {
          setDocumentCode(formCode)
          const docType = typeFromCode(formCode)
          if (docType) setType(docType)
        }
        if (formTitle) setTitle(formTitle)

        const parentCode = extractParentCode(selectedFile.name)
        if (!parentCode) throw new Error('ไม่สามารถตรวจสอบรหัสเอกสารแม่ได้')
        const res = await fetch(`/api/admin/documents?code=${encodeURIComponent(parentCode)}&pageSize=1`)
        const json = await readJsonOrError(res)
        if (!res.ok) throw new Error(json.error ?? 'ไม่สามารถดึงข้อมูลได้')
        const parent = (json.data as Document[] | undefined)?.[0]
        if (!parent) throw new Error(`ไม่พบเอกสาร ${parentCode} ในระบบ`)
        if (parent.revision)       setRevision(parent.revision)
        if (parent.department)     setDepartment(parent.department)
        if (parent.owner_name)     setOwnerName(parent.owner_name)
        if (parent.reviewer_name)  setReviewerName(parent.reviewer_name)
        if (parent.approver_name)  setApproverName(parent.approver_name)
        if (parent.edit_date || parent.expiry_date) setEditDate(parent.edit_date ?? parent.expiry_date ?? '')
        if (parent.effective_date) setEffectiveDate(parent.effective_date)
        if (parent.owner_name || parent.reviewer_name || parent.approver_name || parent.edit_date || parent.expiry_date || parent.effective_date) {
          setCoverDetailsOpen(true)
        }
      } else {
        const fd = new FormData()
        fd.append('file', selectedFile)
        const res = await fetch('/api/admin/documents/extract', { method: 'POST', body: fd })
        const json = await readJsonOrError(res)
        if (!res.ok) throw new Error(json.error ?? 'ไม่สามารถอ่านไฟล์ได้')
        const fields = parseExtractedText(json.text as string)
        if (fields.title)         setTitle(fields.title)
        if (fields.documentCode) {
          const code = fields.documentCode.toUpperCase()
          setDocumentCode(code)
          const dept = deptFromCode(code)
          if (dept) setDepartment(dept)
          const docType = typeFromCode(code)
          if (docType) setType(docType)
        }
        if (fields.revision)      setRevision(fields.revision)
        if (fields.ownerName)     setOwnerName(fields.ownerName)
        if (fields.reviewerName)  setReviewerName(fields.reviewerName)
        if (fields.approverName)  setApproverName(fields.approverName)
        if (fields.editDate)      setEditDate(fields.editDate)
        if (fields.effectiveDate) setEffectiveDate(fields.effectiveDate)
        if (fields.ownerName || fields.reviewerName || fields.approverName || fields.editDate || fields.effectiveDate) {
          setCoverDetailsOpen(true)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ดึงข้อมูลไม่สำเร็จ')
    } finally {
      setExtracting(false)
    }
  }

  async function extractFromWordFile() {
    if (!selectedWordFile || !selectedWordFile.name.match(/\.(docx|xlsx)$/i)) return
    setExtractingWord(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', selectedWordFile)
      const res = await fetch('/api/admin/documents/extract', { method: 'POST', body: fd })
      const json = await readJsonOrError(res)
      if (!res.ok) throw new Error(json.error ?? 'ไม่สามารถอ่านไฟล์ได้')
      const fields = parseExtractedText(json.text as string)
      if (fields.title)        setTitle(fields.title)
      if (fields.documentCode) {
        const code = fields.documentCode.toUpperCase()
        setDocumentCode(code)
        const dept = deptFromCode(code)
        if (dept) setDepartment(dept)
        const docType = typeFromCode(code)
        if (docType) setType(docType)
      }
      if (fields.revision)     setRevision(fields.revision)
      if (fields.ownerName)    setOwnerName(fields.ownerName)
      if (fields.reviewerName) setReviewerName(fields.reviewerName)
      if (fields.approverName) setApproverName(fields.approverName)
      if (fields.editDate)     setEditDate(fields.editDate)
      if (fields.effectiveDate) setEffectiveDate(fields.effectiveDate)
      if (fields.ownerName || fields.reviewerName || fields.approverName || fields.editDate || fields.effectiveDate) {
        setCoverDetailsOpen(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ดึงข้อมูลไม่สำเร็จ')
    } finally {
      setExtractingWord(false)
    }
  }

  async function handleSave() {
    setDuplicateDocumentId(null)
    setUploadProgress(null)
    if (!title.trim())         { setError('กรุณากรอกชื่อเอกสาร'); return }
    if (!documentCode.trim())  { setError('กรุณากรอกรหัสเอกสาร'); return }
    if (revisionWarning) { setError(revisionWarning); return }
    if (isImportCurrent) {
      const revNo = revisionOrderNumber(revision)
      if (revNo === null || revNo <= 0) {
        setError('โหมดนำเข้าเอกสารเดิมต้องระบุ Revision ปัจจุบันมากกว่า 0 เช่น 1 หรือ Rev.01')
        return
      }
      if (!selectedFile) {
        setError('โหมดนำเข้าเอกสารเดิมต้องแนบไฟล์ทางการ Rev ปัจจุบัน')
        return
      }
      if (requiresCover(type) && !legacyCoverIncluded) {
        setError('QP/WI ที่นำเข้า Rev.>0 ต้องใช้ PDF ทางการเดิมที่มีหน้าปกอยู่แล้ว หากไม่มีหน้าปกให้สร้าง Draft ปกติ')
        return
      }
    }

    setSaving(true)
    setError('')

    try {
      // Pre-upload word/excel file directly to R2 via presigned URL to bypass
      // Vercel's 4.5 MB API-route body-size limit.
      let wordFileKey: string | null = null
      let wordFileName: string | null = null
      let wordFileSize: number | null = null
      if (selectedWordFile) {
        const presignParams = new URLSearchParams({
          fileName: selectedWordFile.name,
          fileType: selectedWordFile.type || 'application/octet-stream',
          fileSize: String(selectedWordFile.size),
          docType: type.toLowerCase(),
        })
        const presignRes = await fetch(`/api/admin/documents/presign-word?${presignParams}`)
        const presignJson = await readJsonOrError(presignRes)
        if (!presignRes.ok) {
          setError(presignJson.error ?? 'สร้าง URL อัปโหลดไฟล์ต้นฉบับไม่สำเร็จ')
          setSaving(false)
          return
        }
        const { uploadMode, uploadUrl, key, contentType } = presignJson as { uploadMode?: string; uploadUrl: string; key: string; contentType: string }
        if (uploadMode !== 'direct-r2') {
          setError('production อาจยังไม่ใช่โค้ด direct upload ล่าสุด กรุณา redeploy แล้วลองใหม่')
          setSaving(false)
          return
        }
        try {
          setUploadProgress(0)
          await uploadFileWithProgress(uploadUrl, selectedWordFile, contentType, setUploadProgress)
        } catch (err) {
          setError(`อัปโหลดไฟล์ต้นฉบับไม่สำเร็จ ${err instanceof Error ? err.message : String(err)}`)
          setSaving(false)
          setUploadProgress(null)
          return
        }
        wordFileKey = key
        wordFileName = selectedWordFile.name
        wordFileSize = selectedWordFile.size
      }

      const baseMetadata = {
        title:          title.trim(),
        visibility,
        owner_name:     ownerName.trim()     || undefined,
        reviewer_name:  reviewerName.trim()  || undefined,
        approver_name:  approverName.trim()  || undefined,
        department:     department.trim()    || undefined,
        description:    description.trim() || undefined,
      }
      const meta: Record<string, string | boolean | undefined> = isPublishedCorrection
        ? baseMetadata
        : {
            ...baseMetadata,
            document_code:  documentCode.trim().toUpperCase(),
            type,
            revision:       revision.trim() || '1',
            status:         isImportCurrent ? 'Published' : 'Draft',
            edit_date:      editDate             || undefined,
            expiry_date:    editDate             || undefined,
            effective_date: effectiveDate        || undefined,
            obsolete_date:  isObsolete ? (obsoleteDate || new Date().toISOString().split('T')[0]) : undefined,
            obsolete_reason: isObsolete ? (obsoleteReason.trim() || undefined) : undefined,
            import_mode:    isImportCurrent ? 'current' : undefined,
            legacy_cover_included: isImportCurrent && requiresCover(type) ? legacyCoverIncluded : false,
            imported_current_note: isImportCurrent ? (importedCurrentNote.trim() || undefined) : undefined,
          }

      let res: Response

      if (isEdit) {
        const editUrl = `/api/admin/documents/${doc!.id}${!saveRevision ? '?skipRevision=1' : ''}`
        if (!isPublishedCorrection && (selectedFile || wordFileKey)) {
          const fd = new FormData()
          if (selectedFile) fd.append('file', selectedFile)
          if (wordFileKey) {
            fd.append('word_file_key', wordFileKey)
            fd.append('word_file_name', wordFileName!)
            fd.append('word_file_size', String(wordFileSize!))
          }
          fd.append('meta', JSON.stringify(meta))
          res = await fetch(editUrl, { method: 'PATCH', body: fd })
        } else {
          res = await fetch(editUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(meta),
          })
        }
      } else {
        const fd = new FormData()
        if (selectedFile) fd.append('file', selectedFile)
        if (wordFileKey) {
          fd.append('word_file_key', wordFileKey)
          fd.append('word_file_name', wordFileName!)
          fd.append('word_file_size', String(wordFileSize!))
        }
        fd.append('meta', JSON.stringify(meta))
        res = await fetch('/api/admin/documents', { method: 'POST', body: fd })
      }

      const json = await readJsonOrError(res)
      if (!res.ok) {
        setDuplicateDocumentId(typeof json.documentId === 'string' ? json.documentId : null)
        setError(json.error ?? 'เกิดข้อผิดพลาด')
        setSaving(false)
        return
      }
      onSaved(json as unknown as Document)
    } catch {
      setDuplicateDocumentId(null)
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{
        background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 620,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
            {isEdit ? 'แก้ไขเอกสาร' : (isImportCurrent ? 'นำเข้าเอกสารเดิม Rev.>0' : 'สร้าง Draft เอกสาร')}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,.08)', color: '#B91C1C', fontSize: 13, border: '1px solid rgba(220,38,38,.2)' }}>
              <div>{error}</div>
              {duplicateDocumentId && onDuplicateOpen && (
                <button
                  type="button"
                  onClick={() => onDuplicateOpen(duplicateDocumentId)}
                  style={{ marginTop: 8, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(185,28,28,.35)', background: 'var(--card)', color: '#B91C1C', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}
                >
                  เปิดเอกสารเดิม
                </button>
              )}
            </div>
          )}

          {uploadProgress !== null && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--surface-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
                <span>กำลังอัปโหลดไฟล์</span>
                <span>{uploadProgress}%</span>
              </div>
              <div style={{ height: 7, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ width: `${uploadProgress}%`, height: '100%', borderRadius: 999, background: 'var(--primary)', transition: 'width .15s ease' }} />
              </div>
            </div>
          )}

          {!isEdit && canImportCurrent && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>โหมดการสร้างเอกสาร</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setCreateMode('draft')}
                  style={{ padding: '9px 10px', borderRadius: 8, border: `1px solid ${!isImportCurrent ? 'var(--primary)' : 'var(--border)'}`, background: !isImportCurrent ? 'var(--primary-soft)' : 'var(--card)', color: !isImportCurrent ? 'var(--primary)' : 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700 }}
                >
                  สร้าง Draft ตาม workflow ปกติ
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode('import-current')}
                  style={{ padding: '9px 10px', borderRadius: 8, border: `1px solid ${isImportCurrent ? '#D97706' : 'var(--border)'}`, background: isImportCurrent ? 'rgba(217,119,6,.10)' : 'var(--card)', color: isImportCurrent ? '#B45309' : 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700 }}
                >
                  นำเข้าเอกสารเดิม Rev.&gt;0
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.45 }}>
                {isImportCurrent
                  ? 'ใช้กับเอกสารเก่าที่ใช้งานอยู่แล้วในระบบเดิม ระบบจะสร้างเป็น Published ทันที แล้วค่อยเพิ่มประวัติย้อนหลัง'
                  : 'ใช้กับเอกสารที่ต้องเริ่มจาก Word/Excel และผ่าน Draft → Review → Approved → Published ใช้ได้ทั้ง Rev.00 และ Rev.>0'}
              </div>
            </div>
          )}

          {/* ชื่อเอกสาร */}
          <div>
            <label style={labelStyle}>ชื่อเอกสาร<RequiredMark /></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="คู่มือคุณภาพ กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี" />
          </div>

          {/* รหัสเอกสาร + ประเภท */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>รหัสเอกสาร<RequiredMark /></label>
              <input
                value={documentCode}
                disabled={isPublishedCorrection}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase()
                  setDocumentCode(val)
                  const dept = deptFromCode(val)
                  if (dept) setDepartment(dept)
                  const docType = typeFromCode(val)
                  if (docType) setType(docType)
                }}
                style={isPublishedCorrection ? lockedInputStyle : inputStyle}
                placeholder="เช่น QM-LAB-01"
              />
            </div>
            <div>
              <label style={labelStyle}>ประเภทเอกสาร<RequiredMark /></label>
              <select
                value={type}
                disabled={isPublishedCorrection}
                onChange={(e) => setType(e.target.value)}
                style={isPublishedCorrection ? lockedInputStyle : { ...inputStyle }}
              >
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* การเผยแพร่ + สถานะ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>การเผยแพร่</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} style={{ ...inputStyle }}>
                {DOC_VISIBILITIES.map((v) => <option key={v} value={v}>{v === 'Public' ? 'Public — เผยแพร่' : 'Internal — ภายใน'}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>สถานะ</label>
              <select value={status} disabled style={{ ...inputStyle, opacity: 0.72, cursor: 'not-allowed' }}>
                {availableStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Revision + แผนก */}
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Revision</label>
              <input
                value={revision}
                disabled={isPublishedCorrection}
                onChange={(e) => {
                  setRevision(e.target.value)
                  if (error === revisionWarning) setError('')
                }}
                onBlur={() => {
                  if (revisionWarning) {
                    alert(revisionWarning)
                    setError(revisionWarning)
                  }
                }}
                style={{
                  ...inputStyle,
                  borderColor: revisionWarning ? 'rgba(220,38,38,.55)' : 'var(--border)',
                  background: isPublishedCorrection ? 'var(--surface-2)' : revisionWarning ? 'rgba(220,38,38,.04)' : 'var(--card)',
                  opacity: isPublishedCorrection ? 0.72 : 1,
                  cursor: isPublishedCorrection ? 'not-allowed' : 'text',
                }}
                placeholder="1"
              />
              {revisionWarning && (
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--danger)', lineHeight: 1.35 }}>
                  {revisionWarning}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>แผนก</label>
              <input value={department} onChange={(e) => setDepartment(e.target.value)} style={inputStyle} placeholder="เช่น เคมีคลินิก" />
            </div>
          </div>

          {/* วันที่ยกเลิก + เหตุผล (เฉพาะ Obsolete) */}
          {isObsolete && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '14px 16px', borderRadius: 10, background: 'rgba(220,38,38,.05)', border: '1px solid rgba(220,38,38,.15)' }}>
              <div>
                <label style={{ ...labelStyle, color: 'var(--danger)' }}>วันที่ยกเลิก</label>
                <input type="date" value={obsoleteDate} onChange={(e) => setObsoleteDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ ...labelStyle, color: 'var(--danger)' }}>เหตุผลที่ยกเลิก</label>
                <input value={obsoleteReason} onChange={(e) => setObsoleteReason(e.target.value)} style={inputStyle} placeholder="เหตุผล (ไม่บังคับ)" />
              </div>
            </div>
          )}

          {/* รายละเอียดการแก้ไข */}
          <div>
            <label style={labelStyle}>รายละเอียดการแก้ไข</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="สรุปสิ่งที่เปลี่ยนแปลงในฉบับนี้ (ไม่บังคับ)"
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Cover metadata */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--card)' }}>
            <button
              type="button"
              onClick={() => setCoverDetailsOpen((v) => !v)}
              style={{ width: '100%', padding: '11px 14px', border: 'none', background: coverDetailsOpen ? 'var(--surface-2)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontFamily: 'inherit', textAlign: 'left' }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>ข้อมูลสำหรับหน้าปก</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>กรอกได้ภายหลัง ก่อน Publish</div>
              </div>
              <Icon name={coverDetailsOpen ? 'chevDown' : 'chevRight'} size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            </button>

            {coverDetailsOpen && (
              <div style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>ผู้จัดทำ</label>
                    <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} style={inputStyle} placeholder="ชื่อผู้จัดทำ" />
                  </div>
                  <div>
                    <label style={labelStyle}>ผู้รับรอง</label>
                    <input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} style={inputStyle} placeholder="ชื่อผู้รับรอง" />
                  </div>
                  <div>
                    <label style={labelStyle}>ผู้อนุมัติ</label>
                    <input value={approverName} onChange={(e) => setApproverName(e.target.value)} style={inputStyle} placeholder="ชื่อผู้อนุมัติ" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>วันที่แก้ไข/ทบทวน</label>
                    <input
                      type="date"
                      value={editDate}
                      disabled={isPublishedCorrection}
                      onChange={(e) => setEditDate(e.target.value)}
                      style={isPublishedCorrection ? lockedInputStyle : inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>วันที่มีผลบังคับใช้</label>
                    <input
                      type="date"
                      value={effectiveDate}
                      disabled={isPublishedCorrection}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      style={isPublishedCorrection ? lockedInputStyle : inputStyle}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* File Upload — 2 zones side by side */}
          {!isPublishedCorrection && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Official file zone */}
            <div style={{ minWidth: 0 }}>
              <label style={labelStyle}>
                {isImportCurrent
                  ? (requiresCover(type) ? 'PDF ทางการเดิม Rev ปัจจุบัน (มีหน้าปก)' : 'ไฟล์ทางการ Rev ปัจจุบัน')
                  : requiresCover(type)
                  ? (isEdit ? 'เปลี่ยน PDF เนื้อหา (ไม่มีหน้าปก)' : 'PDF เนื้อหา (ไม่มีหน้าปก)')
                  : (isEdit ? 'เปลี่ยนไฟล์ทางการ' : 'ไฟล์ทางการ')
                }
                {isImportCurrent && <RequiredMark />}
              </label>
              <div
                onDragEnter={onDragEnter}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#DC2626' : 'var(--border)'}`,
                  borderRadius: 10, padding: '12px',
                  background: dragOver ? 'rgba(220,38,38,.06)' : 'var(--surface-2)',
                  cursor: 'pointer', transition: 'all .15s', height: 72,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}
              >
                {selectedFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0 }}>
                    <Icon name="doc" size={16} style={{ color: '#DC2626', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtSize(selectedFile.size)}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', flexShrink: 0 }}>
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>📄</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {requiresCover(type) ? 'PDF' : 'PDF / Office'} &nbsp;<span style={{ color: 'var(--primary)', fontWeight: 600 }}>เลือกไฟล์</span>
                    </span>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept={requiresCover(type) ? '.pdf,application/pdf' : '.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
              </div>
              {selectedFile && (selectedFile.type === 'application/pdf' || /\.pdf$/i.test(selectedFile.name)) && (
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={extractFromFile} disabled={extracting}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, cursor: extracting ? 'default' : 'pointer', padding: '4px 10px', borderRadius: 6, fontFamily: 'inherit', background: 'transparent', border: `1px solid ${extracting ? 'var(--border)' : 'var(--primary)'}`, color: extracting ? 'var(--muted)' : 'var(--primary)', transition: 'all .15s' }}>
                    {extracting ? '⏳ กำลังอ่าน...' : '✦ ดึงข้อมูล'}
                  </button>
                </div>
              )}
            </div>

            {/* Word / Excel zone */}
            <div style={{ minWidth: 0 }}>
              <label style={labelStyle}>
                {isImportCurrent ? 'ไฟล์ต้นฉบับ Word/Excel (ถ้ามี)' : (isEdit ? 'เปลี่ยนไฟล์ต้นฉบับ Word/Excel' : 'ไฟล์ต้นฉบับ Word/Excel')}
              </label>
              {isEdit && doc?.word_name && !selectedWordFile && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ปัจจุบัน: {doc.word_name}
                </div>
              )}
              <div
                onDragEnter={onWordDragEnter}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={onWordDragLeave}
                onDrop={onWordDrop}
                onClick={() => wordFileRef.current?.click()}
                style={{
                  border: `2px dashed ${wordDragOver ? '#059669' : 'var(--border)'}`,
                  borderRadius: 10, padding: '12px',
                  background: wordDragOver ? 'rgba(5,150,105,.06)' : 'var(--surface-2)',
                  cursor: 'pointer', transition: 'all .15s', height: 72,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}
              >
                {selectedWordFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0 }}>
                    <Icon name="doc" size={16} style={{ color: '#059669', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedWordFile.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtSize(selectedWordFile.size)}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedWordFile(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', flexShrink: 0 }}>
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>📝</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>DOC / DOCX / XLSX &nbsp;<span style={{ color: 'var(--primary)', fontWeight: 600 }}>เลือกไฟล์</span></span>
                  </div>
                )}
                <input ref={wordFileRef} type="file" accept=".doc,.docx,.xlsx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleWordFile(f); e.target.value = '' }} />
              </div>
              <div style={{ marginTop: 5, fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>
                รองรับ DOC, DOCX, XLSX; ดึงข้อมูลอัตโนมัติได้จาก DOCX/XLSX
              </div>
              {selectedWordFile && selectedWordFile.name.match(/\.(docx|xlsx)$/i) && (
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={extractFromWordFile} disabled={extractingWord}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, cursor: extractingWord ? 'default' : 'pointer', padding: '4px 10px', borderRadius: 6, fontFamily: 'inherit', background: 'transparent', border: `1px solid ${extractingWord ? 'var(--border)' : '#059669'}`, color: extractingWord ? 'var(--muted)' : '#059669', transition: 'all .15s' }}>
                    {extractingWord ? '⏳ กำลังอ่าน...' : '✦ ดึงข้อมูล'}
                  </button>
                </div>
              )}
            </div>
          </div>}

          {!isPublishedCorrection && isImportCurrent && requiresCover(type) && (
            <div style={{ border: '1px solid rgba(217,119,6,.25)', borderRadius: 10, background: 'rgba(217,119,6,.07)', padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: '#92400E', lineHeight: 1.45, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={legacyCoverIncluded}
                  onChange={(e) => setLegacyCoverIncluded(e.target.checked)}
                  style={{ marginTop: 3, accentColor: '#D97706' }}
                />
                <span>
                  ไฟล์ QP/WI นี้เป็น PDF ทางการเดิมที่มีหน้าปกอยู่แล้ว
                  <br />
                  <span style={{ color: 'var(--muted)' }}>ระบบจะไม่สร้างหน้าปกซ้ำให้เอกสารนำเข้า Rev ปัจจุบันนี้ การสร้างหน้าปกระบบจะเริ่มใน revision ถัดไป</span>
                </span>
              </label>
            </div>
          )}

          {!isPublishedCorrection && isImportCurrent && (
            <div>
              <label style={labelStyle}>หมายเหตุการนำเข้า</label>
              <input
                value={importedCurrentNote}
                onChange={(e) => setImportedCurrentNote(e.target.value)}
                style={inputStyle}
                placeholder="เช่น นำเข้า Rev ปัจจุบันจาก Google Drive / ระบบเดิม"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
          {isEdit && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', marginRight: 'auto' }}>
              <input
                type="checkbox"
                checked={saveRevision}
                onChange={(e) => setSaveRevision(e.target.checked)}
                style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--primary)' }}
              />
              เก็บไฟล์เดิมไว้ในประวัติการแก้ไข
            </label>
          )}
          <button
            onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)' }}
          >
            ยกเลิก
          </button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !!revisionWarning}>
            {saving
              ? (isEdit ? 'กำลังบันทึก...' : (isImportCurrent ? 'กำลังนำเข้า...' : 'กำลังสร้าง Draft...'))
              : (isEdit ? 'บันทึกการแก้ไข' : (isImportCurrent ? 'นำเข้าเป็น Published' : 'บันทึกเป็น Draft'))}
          </Button>
        </div>
      </div>
    </div>
  )
}
