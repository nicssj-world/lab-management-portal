import { createHash } from 'node:crypto'
import path from 'node:path'
import * as XLSX from 'xlsx'

export const HIS_TRAINING_SOURCE = 'HIS' as const
export const HIS_TRAINING_MAX_FILE_BYTES = 5 * 1024 * 1024
export const HIS_TRAINING_MAX_ROWS = 500
export const HIS_TRAINING_MAX_FILES = 50

export type HisTrainingProfile = {
  id: string
  ephisId: string
  name: string
}

export type HisTrainingSourceDetails = {
  budgetYear: number | null
  activityType: string | null
  dayCount: number | null
}

export type HisTrainingPreviewRow = {
  key: string
  sourceRecordId: string
  topic: string
  trainingDate: string | null
  trainingEndDate: string | null
  hours: number | null
  provider: string | null
  location: string | null
  trainingType: 'in_plan'
  sourceDetails: HisTrainingSourceDetails
  status: 'ready' | 'duplicate' | 'conflict' | 'error'
  error: string | null
}

export type HisTrainingParsedFile = {
  fileName: string
  profileId: string
  profileName: string
  ephisId: string
  fingerprint: string
  rows: HisTrainingPreviewRow[]
}

export type HisTrainingFilePreview = {
  fileName: string
  ephisId: string
  fingerprint: string | null
  profileId: string | null
  profileName: string | null
  rows: HisTrainingPreviewRow[]
  error: string | null
}

export type HisTrainingImportSummary = {
  files: number
  rows: number
  ready: number
  duplicate: number
  conflict: number
  error: number
}

type HisRow = Record<string, unknown>

function text(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function nullableText(value: unknown): string | null {
  const valueText = text(value)
  return valueText || null
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function dateOnly(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getFullYear()).padStart(4, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  const valueText = text(value)
  if (!valueText) return null
  const parsed = new Date(valueText)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

function normalizePersonName(value: string): string {
  return value
    .replace(/^(นาย|นางสาว|นาง|น\.ส\.)\s*/u, '')
    .replace(/[\s.\-]/g, '')
    .toLocaleLowerCase('th-TH')
}

export function ephisIdFromHisFileName(fileName: string): string {
  return path.basename(fileName, path.extname(fileName)).trim()
}

function workbookRows(bytes: Buffer): HisRow[] {
  const workbook = XLSX.read(bytes, { type: 'buffer', cellDates: true })
  const firstSheet = workbook.SheetNames[0]
  if (!firstSheet) return []
  return XLSX.utils.sheet_to_json<HisRow>(workbook.Sheets[firstSheet], { defval: null, raw: true })
}

function validationError(row: Omit<HisTrainingPreviewRow, 'status' | 'error'>): string | null {
  if (!row.sourceRecordId) return 'ไม่พบรหัสรายการ HIS (trnno)'
  if (!row.topic) return 'ไม่พบหัวข้อการอบรม'
  if (row.topic.length > 300) return 'หัวข้อการอบรมยาวเกิน 300 ตัวอักษร'
  if (!row.trainingDate) return 'ไม่พบวันที่เริ่มอบรม'
  if (row.trainingEndDate && row.trainingEndDate < row.trainingDate) return 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม'
  return null
}

export function parseHisTrainingWorkbook(
  bytes: Buffer,
  options: { fileName: string; profile: HisTrainingProfile },
): HisTrainingParsedFile {
  const extension = path.extname(options.fileName).toLowerCase()
  if (extension !== '.xls' && extension !== '.xlsx') throw new Error('รองรับเฉพาะไฟล์ .xls และ .xlsx')
  if (bytes.byteLength > HIS_TRAINING_MAX_FILE_BYTES) throw new Error('ไฟล์ต้องไม่เกิน 5 MB')
  const fingerprint = createHash('sha256').update(bytes).digest('hex')
  const rows = workbookRows(bytes)
  const fileEphisId = ephisIdFromHisFileName(options.fileName)
  if (fileEphisId !== options.profile.ephisId) throw new Error('ชื่อไฟล์ไม่ตรงกับ E-Phis ของบุคลากร')

  if (rows.length > HIS_TRAINING_MAX_ROWS) throw new Error(`ไฟล์หนึ่งต้องมีไม่เกิน ${HIS_TRAINING_MAX_ROWS} รายการ`)
  const sourcePersonIds = new Set(rows.map((row) => text(row.perid)).filter(Boolean))
  if (sourcePersonIds.size > 1) throw new Error('ไฟล์มีข้อมูลมากกว่าหนึ่งบุคลากร')
  const sourceNames = new Set(rows.map((row) => normalizePersonName(`${text(row.fname)}${text(row.lname)}`)).filter(Boolean))
  if (sourceNames.size !== 1 || !sourceNames.has(normalizePersonName(options.profile.name))) {
    throw new Error('ชื่อบุคลากรในไฟล์ไม่ตรงกับโปรไฟล์')
  }

  const seenSourceIds = new Set<string>()
  return {
    fileName: options.fileName,
    profileId: options.profile.id,
    profileName: options.profile.name,
    ephisId: options.profile.ephisId,
    fingerprint,
    rows: rows.map((row) => {
      const sourceRecordId = text(row.trnno)
      const dayCount = finiteNumber(row.daynum)
      const sourceHours = finiteNumber(row.hournum)
      const preview = {
        key: `${fingerprint}:${sourceRecordId}`,
        sourceRecordId,
        topic: text(row.title),
        trainingDate: dateOnly(row.startdate),
        trainingEndDate: dateOnly(row.enddate),
        hours: sourceHours ?? (dayCount == null ? null : dayCount * 8),
        provider: nullableText(row.plcmng),
        location: nullableText(row.place),
        trainingType: 'in_plan' as const,
        sourceDetails: {
          budgetYear: finiteNumber(row.bdgyear),
          activityType: nullableText(row.trnnm),
          dayCount,
        },
      }
      let error = validationError(preview)
      if (!error && seenSourceIds.has(sourceRecordId)) error = 'รหัสรายการ HIS ซ้ำภายในไฟล์'
      if (sourceRecordId) seenSourceIds.add(sourceRecordId)
      return { ...preview, status: error ? 'error' as const : 'ready' as const, error }
    }),
  }
}

export function summarizeHisTrainingPreview(files: HisTrainingFilePreview[]): HisTrainingImportSummary {
  const rows = files.flatMap((file) => file.rows)
  return {
    files: files.length,
    rows: rows.length,
    ready: rows.filter((row) => row.status === 'ready').length,
    duplicate: rows.filter((row) => row.status === 'duplicate').length,
    conflict: rows.filter((row) => row.status === 'conflict').length,
    error: rows.filter((row) => row.status === 'error').length + files.filter((file) => file.error).length,
  }
}

type ExistingHisTraining = {
  source_record_id?: unknown
  topic?: unknown
  training_date?: unknown
  training_end_date?: unknown
  hours?: unknown
  provider?: unknown
  location?: unknown
  training_type?: unknown
  source_details?: unknown
}

function sameExistingRow(row: HisTrainingPreviewRow, existing: ExistingHisTraining): boolean {
  const details = (existing.source_details ?? {}) as Record<string, unknown>
  return text(existing.topic) === row.topic
    && nullableText(existing.training_date) === row.trainingDate
    && nullableText(existing.training_end_date) === row.trainingEndDate
    && finiteNumber(existing.hours) === row.hours
    && nullableText(existing.provider) === row.provider
    && nullableText(existing.location) === row.location
    && text(existing.training_type) === row.trainingType
    && finiteNumber(details.budgetYear) === row.sourceDetails.budgetYear
    && nullableText(details.activityType) === row.sourceDetails.activityType
    && finiteNumber(details.dayCount) === row.sourceDetails.dayCount
}

export function markHisTrainingDuplicates(
  rows: HisTrainingPreviewRow[],
  existingRows: ExistingHisTraining[],
): HisTrainingPreviewRow[] {
  const existingById = new Map(existingRows.map((row) => [text(row.source_record_id), row]))
  return rows.map((row) => {
    if (row.status === 'error') return row
    const existing = existingById.get(row.sourceRecordId)
    if (!existing) return row
    return sameExistingRow(row, existing)
      ? { ...row, status: 'duplicate', error: 'มีรายการนี้ในระบบแล้ว' }
      : { ...row, status: 'conflict', error: 'รหัสรายการ HIS เดิมมีข้อมูลต่างจากไฟล์นี้' }
  })
}
