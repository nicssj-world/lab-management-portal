import { GetObjectCommand } from '@aws-sdk/client-s3'

import { r2, R2_BUCKET } from '@/lib/r2/client'
import {
  UnsafeStampLayoutError,
  shouldUseUncontrolledCopy,
  stampUncontrolledPdf,
} from '@/lib/documents/uncontrolled-pdf'
import { supabaseAdmin } from '@/lib/supabase/admin'

const validationDate = '12/07/2026'

async function readR2Object(key: string) {
  const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  if (!object.Body || typeof object.Body.transformToByteArray !== 'function') {
    throw new Error('ไม่สามารถอ่านไฟล์จาก R2 ได้')
  }
  return object.Body.transformToByteArray()
}

async function main() {
  const { data: documents, error } = await supabaseAdmin
    .from('documents')
    .select('id, document_code, file_url, file_name, mime_type, type, status')
    .in('type', ['QM', 'QP', 'WI', 'Manual'])
    .eq('status', 'Published')
    .is('deleted_at', null)
    .not('file_url', 'is', null)

  if (error) throw error

  const totals = {
    documents: documents?.length ?? 0,
    eligible: 0,
    skippedNonPdf: 0,
    safe: 0,
    unsafe: 0,
    parseFailures: 0,
    previewBytes: 0,
    downloadBytes: 0,
    stampedPages: 0,
    historyPagesSkipped: 0,
    failures: [] as Array<{ id: string; documentCode: string; kind: 'unsafe' | 'parse'; message: string }>,
  }

  for (const document of documents ?? []) {
    if (!document.file_url) continue
    const eligible = shouldUseUncontrolledCopy({
      audience: 'public',
      variant: 'preview',
      requestedPath: document.file_url,
      officialPath: document.file_url,
      type: document.type,
      status: document.status,
      mimeType: document.mime_type,
      fileName: document.file_name,
    })
    if (!eligible) {
      totals.skippedNonPdf += 1
      continue
    }

    totals.eligible += 1
    try {
      const source = await readR2Object(document.file_url)
      const preview = await stampUncontrolledPdf(source, { variant: 'preview', downloadDate: validationDate })
      const download = await stampUncontrolledPdf(source, { variant: 'download', downloadDate: validationDate })
      totals.safe += 1
      totals.previewBytes += preview.bytes.byteLength
      totals.downloadBytes += download.bytes.byteLength
      totals.stampedPages += preview.stampedPages
      totals.historyPagesSkipped += preview.skippedHistoryPages
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      if (cause instanceof UnsafeStampLayoutError) {
        totals.unsafe += 1
        totals.failures.push({ id: document.id, documentCode: document.document_code, kind: 'unsafe', message })
      } else {
        totals.parseFailures += 1
        totals.failures.push({ id: document.id, documentCode: document.document_code, kind: 'parse', message })
      }
    }
  }

  console.log(JSON.stringify(totals, null, 2))
  if (totals.unsafe > 0 || totals.parseFailures > 0) process.exitCode = 1
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
