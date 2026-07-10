import { buildDocumentDownloadFilename } from './download-filename'

export type BulkDownloadKind = 'pdf' | 'source' | 'both'

export type BulkDownloadFilters = {
  type?: string | null
  department?: string | null
  search?: string | null
  visibility?: string | null
}

export type BulkDownloadDocument = {
  id: string
  document_code: string
  title: string
  type: string
  department: string | null
  status: string
  visibility: string
  file_url: string | null
  file_name: string | null
  file_size: number | null
  word_url: string | null
  word_name: string | null
  word_size: number | null
}

export type BulkDownloadEntry = {
  documentId: string
  sourcePath: string
  zipPath: string
  fileName: string
  size: number
  kind: Exclude<BulkDownloadKind, 'both'>
}

export type BulkDownloadSkipped = {
  documentId: string
  documentCode: string
  title: string
  reason: 'missing-pdf' | 'missing-source'
}

export type BulkDownloadPlan = {
  matchedDocuments: number
  entries: BulkDownloadEntry[]
  skipped: BulkDownloadSkipped[]
  estimatedBytes: number
  warning: { code: 'large-download'; message: string } | null
}

export const BULK_DOWNLOAD_WARN_BYTES = 200 * 1024 * 1024
export const BULK_DOWNLOAD_MAX_BYTES = 300 * 1024 * 1024
export const BULK_DOWNLOAD_MAX_DOCUMENTS = 100

export function canUseBulkDocumentDownload(actor: { role: string; doc_role?: string | null }) {
  const workflowRole = actor.doc_role ?? actor.role
  return actor.role === 'Admin'
    || actor.role === 'Document Controller'
    || workflowRole === 'Document Controller'
    || workflowRole === 'Reviewer'
}

function cleanFilter(value: string | null | undefined) {
  const clean = value?.trim()
  return clean || undefined
}

function safeZipSegment(value: string) {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    || 'document'
}

function requestedKinds(kind: BulkDownloadKind): Exclude<BulkDownloadKind, 'both'>[] {
  if (kind === 'both') return ['pdf', 'source']
  return [kind]
}

function sourceFileName(row: BulkDownloadDocument, fileName: string | null) {
  return buildDocumentDownloadFilename({
    document_code: row.document_code,
    title: row.title,
    file_name: fileName,
  })
}

function addEntry(
  entries: BulkDownloadEntry[],
  skipped: BulkDownloadSkipped[],
  row: BulkDownloadDocument,
  kind: Exclude<BulkDownloadKind, 'both'>,
) {
  if (kind === 'pdf') {
    if (!row.file_url) {
      skipped.push({ documentId: row.id, documentCode: row.document_code, title: row.title, reason: 'missing-pdf' })
      return
    }
    const fileName = sourceFileName(row, row.file_name)
    entries.push({
      documentId: row.id,
      sourcePath: row.file_url,
      zipPath: `PDF/${safeZipSegment(fileName)}`,
      fileName,
      size: row.file_size ?? 0,
      kind,
    })
    return
  }

  if (!row.word_url) {
    skipped.push({ documentId: row.id, documentCode: row.document_code, title: row.title, reason: 'missing-source' })
    return
  }
  const fileName = sourceFileName(row, row.word_name)
  entries.push({
    documentId: row.id,
    sourcePath: row.word_url,
    zipPath: `Word-Excel/${safeZipSegment(fileName)}`,
    fileName,
    size: row.word_size ?? 0,
    kind,
  })
}

export function planDocumentZip(rows: BulkDownloadDocument[], options: { kind: BulkDownloadKind }): BulkDownloadPlan {
  if (rows.length > BULK_DOWNLOAD_MAX_DOCUMENTS) {
    throw new Error(`เลือกเอกสารได้ไม่เกิน ${BULK_DOWNLOAD_MAX_DOCUMENTS} เอกสารต่อครั้ง กรุณาลด filter ให้แคบลง`)
  }

  const entries: BulkDownloadEntry[] = []
  const skipped: BulkDownloadSkipped[] = []
  for (const row of rows) {
    for (const kind of requestedKinds(options.kind)) {
      addEntry(entries, skipped, row, kind)
    }
  }

  const estimatedBytes = entries.reduce((total, entry) => total + entry.size, 0)
  if (estimatedBytes > BULK_DOWNLOAD_MAX_BYTES) {
    throw new Error('ขนาดไฟล์รวมเกิน 300 MB กรุณาลด filter ให้แคบลง')
  }

  return {
    matchedDocuments: rows.length,
    entries,
    skipped,
    estimatedBytes,
    warning: estimatedBytes > BULK_DOWNLOAD_WARN_BYTES
      ? { code: 'large-download', message: 'ไฟล์ ZIP นี้มีขนาดเกิน 200 MB อาจใช้เวลานาน' }
      : null,
  }
}

export function buildBulkDownloadQuery(filters: BulkDownloadFilters) {
  return {
    ...(cleanFilter(filters.type) && cleanFilter(filters.type) !== 'All' ? { type: cleanFilter(filters.type) } : {}),
    ...(cleanFilter(filters.department) ? { department: cleanFilter(filters.department) } : {}),
    ...(cleanFilter(filters.search) ? { search: cleanFilter(filters.search) } : {}),
    ...(cleanFilter(filters.visibility) ? { visibility: cleanFilter(filters.visibility) } : {}),
    status: 'Published',
  }
}

export function buildBulkDownloadFilename(filters: BulkDownloadFilters) {
  const parts = ['documents-export', cleanFilter(filters.department), cleanFilter(filters.type)]
    .filter((part): part is string => Boolean(part && part !== 'All'))
  return `${parts.map(safeZipSegment).join('-')}.zip`
}

export function buildDownloadSummary(plan: BulkDownloadPlan, filters: BulkDownloadFilters) {
  const lines = [
    'Documents bulk download summary',
    '',
    'Filters',
    `Status: Published`,
    `Type: ${cleanFilter(filters.type) && cleanFilter(filters.type) !== 'All' ? cleanFilter(filters.type) : 'All'}`,
    `Department: ${cleanFilter(filters.department) ?? 'All'}`,
    `Search: ${cleanFilter(filters.search) ?? '-'}`,
    `Visibility: ${cleanFilter(filters.visibility) ?? 'All'}`,
    '',
    `Matched documents: ${plan.matchedDocuments}`,
    `Exported files: ${plan.entries.length}`,
    `Skipped files: ${plan.skipped.length}`,
    `Estimated source bytes: ${plan.estimatedBytes}`,
  ]

  if (plan.warning) {
    lines.push('', `Warning: ${plan.warning.message}`)
  }

  if (plan.skipped.length > 0) {
    lines.push('', 'Skipped')
    for (const item of plan.skipped) {
      const reason = item.reason === 'missing-pdf' ? 'missing PDF' : 'missing Word/Excel'
      lines.push(`- ${item.documentCode} ${item.title}: ${reason}`)
    }
  }

  return `${lines.join('\n')}\n`
}
