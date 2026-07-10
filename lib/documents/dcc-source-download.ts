import { buildDocumentDownloadFilename } from './download-filename'

export type DccSourceDraft = {
  draftId: string
  documentId: string
  documentCode: string
  title: string
  revision: string | null
  wordUrl: string | null
  wordName: string | null
  wordSize: number | null
}

export type DccSourceDownloadEntry = {
  draftId: string
  documentId: string
  sourcePath: string
  zipPath: string
  fileName: string
  size: number
}

export type DccSourceSkipped = {
  draftId: string
  documentId: string
  documentCode: string
  title: string
  reason: 'missing-source' | 'read-failed'
}

export type DccSourceDownloadPlan = {
  matchedDrafts: number
  entries: DccSourceDownloadEntry[]
  skipped: DccSourceSkipped[]
  estimatedBytes: number
  warning: { code: 'large-download'; message: string } | null
}

export const DCC_SOURCE_DOWNLOAD_WARN_BYTES = 200 * 1024 * 1024
export const DCC_SOURCE_DOWNLOAD_MAX_BYTES = 300 * 1024 * 1024
export const DCC_SOURCE_DOWNLOAD_MAX_DRAFTS = 100

function safeZipSegment(value: string) {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    || 'document'
}

function sourceFileName(row: DccSourceDraft) {
  return buildDocumentDownloadFilename({
    document_code: row.documentCode,
    title: row.title,
    file_name: row.wordName,
  })
}

export function planDccSourceZip(rows: DccSourceDraft[]): DccSourceDownloadPlan {
  if (rows.length > DCC_SOURCE_DOWNLOAD_MAX_DRAFTS) {
    throw new Error(`เลือกได้ไม่เกิน ${DCC_SOURCE_DOWNLOAD_MAX_DRAFTS} รายการต่อครั้ง`)
  }

  const entries: DccSourceDownloadEntry[] = []
  const skipped: DccSourceSkipped[] = []

  for (const row of rows) {
    if (!row.wordUrl) {
      skipped.push({
        draftId: row.draftId,
        documentId: row.documentId,
        documentCode: row.documentCode,
        title: row.title,
        reason: 'missing-source',
      })
      continue
    }

    const fileName = sourceFileName(row)
    entries.push({
      draftId: row.draftId,
      documentId: row.documentId,
      sourcePath: row.wordUrl,
      zipPath: `Word-Excel/${safeZipSegment(fileName)}`,
      fileName,
      size: row.wordSize ?? 0,
    })
  }

  const estimatedBytes = entries.reduce((total, entry) => total + entry.size, 0)
  if (estimatedBytes > DCC_SOURCE_DOWNLOAD_MAX_BYTES) {
    throw new Error('ขนาดไฟล์รวมเกิน 300 MB กรุณาลดจำนวนรายการ')
  }

  return {
    matchedDrafts: rows.length,
    entries,
    skipped,
    estimatedBytes,
    warning: estimatedBytes > DCC_SOURCE_DOWNLOAD_WARN_BYTES
      ? { code: 'large-download', message: 'ไฟล์ ZIP นี้มีขนาดเกิน 200 MB อาจใช้เวลานาน' }
      : null,
  }
}

export function buildDccSourceDownloadFilename(now = new Date()) {
  return `dcc-source-files-${now.toISOString().slice(0, 10)}.zip`
}

export function buildDccSourceDownloadSummary(plan: DccSourceDownloadPlan) {
  const lines = [
    'DCC source download summary',
    '',
    `Matched drafts: ${plan.matchedDrafts}`,
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
      const reason = item.reason === 'read-failed' ? 'read failed' : 'missing Word/Excel'
      lines.push(`- ${item.documentCode} ${item.title}: ${reason}`)
    }
  }

  return `${lines.join('\n')}\n`
}
