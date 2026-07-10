import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { zipSync, strToU8 } from 'fflate'
import { getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  buildDccSourceDownloadFilename,
  buildDccSourceDownloadSummary,
  DCC_SOURCE_DOWNLOAD_MAX_DRAFTS,
  planDccSourceZip,
  type DccSourceDownloadEntry,
  type DccSourceDownloadPlan,
  type DccSourceDraft,
  type DccSourceSkipped,
} from '@/lib/documents/dcc-source-download'
import { contentDispositionForDownload } from '@/lib/documents/download-filename'

type Payload = {
  draftIds?: unknown
}

type DraftRow = {
  id: string
  document_id: string
  revision: string | null
  title: string | null
  word_url: string | null
  word_name: string | null
  word_size: number | null
}

type ParentDocRow = {
  id: string
  document_code: string
  title: string
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function canDccSourceDownload(actor: { role: string; doc_role?: string | null }) {
  return actor.role === 'Admin'
    || actor.role === 'Document Controller'
    || actor.doc_role === 'Document Controller'
}

function parseDraftIds(payload: Payload) {
  const ids = Array.isArray(payload.draftIds)
    ? payload.draftIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : []
  return Array.from(new Set(ids))
}

async function objectBytes(path: string) {
  const result = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: path }))
  const body = result.Body
  if (!body) throw new Error(`อ่านไฟล์จากคลังไม่สำเร็จ: ${path}`)
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray())
  }
  const chunks: Uint8Array[] = []
  for await (const chunk of body as AsyncIterable<Uint8Array | Buffer>) {
    chunks.push(chunk instanceof Buffer ? new Uint8Array(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

function finalPlanAfterReads(
  base: DccSourceDownloadPlan,
  entries: DccSourceDownloadEntry[],
  skipped: DccSourceSkipped[],
): DccSourceDownloadPlan {
  return {
    ...base,
    entries,
    skipped,
    estimatedBytes: entries.reduce((total, entry) => total + entry.size, 0),
  }
}

export async function POST(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!canDccSourceDownload(actor)) return jsonForbidden()

  let payload: Payload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 422 })
  }

  const draftIds = parseDraftIds(payload)
  if (draftIds.length === 0) return NextResponse.json({ error: 'ไม่มีรายการเอกสาร' }, { status: 422 })
  if (draftIds.length > DCC_SOURCE_DOWNLOAD_MAX_DRAFTS) {
    return NextResponse.json({ error: `เลือกได้ไม่เกิน ${DCC_SOURCE_DOWNLOAD_MAX_DRAFTS} รายการต่อครั้ง` }, { status: 422 })
  }

  try {
    const { data: draftData, error: draftError } = await supabaseAdmin
      .from('document_revision_drafts')
      .select('id, document_id, revision, title, word_url, word_name, word_size')
      .in('id', draftIds)
      .eq('status', 'Draft')
      .is('cancelled_at', null)
      .not('word_url', 'is', null)
      .limit(DCC_SOURCE_DOWNLOAD_MAX_DRAFTS + 1)

    if (draftError) return NextResponse.json({ error: draftError.message }, { status: 500 })

    const drafts = (draftData ?? []) as DraftRow[]
    const docIds = Array.from(new Set(drafts.map((draft) => draft.document_id).filter(Boolean)))
    const { data: parentData, error: parentError } = docIds.length > 0
      ? await supabaseAdmin
        .from('documents')
        .select('id, document_code, title')
        .in('id', docIds)
        .is('deleted_at', null)
      : { data: [] as ParentDocRow[], error: null }

    if (parentError) return NextResponse.json({ error: parentError.message }, { status: 500 })

    const parentById = new Map<string, ParentDocRow>(((parentData ?? []) as ParentDocRow[]).map((doc) => [doc.id, doc]))
    const rows: DccSourceDraft[] = drafts
      .map((draft): DccSourceDraft | null => {
        const parent = parentById.get(draft.document_id)
        if (!parent) return null
        return {
          draftId: draft.id,
          documentId: draft.document_id,
          documentCode: parent.document_code,
          title: draft.title ?? parent.title,
          revision: draft.revision,
          wordUrl: draft.word_url,
          wordName: draft.word_name,
          wordSize: draft.word_size,
        }
      })
      .filter((row): row is DccSourceDraft => row !== null)
      .sort((a, b) => a.documentCode.localeCompare(b.documentCode))

    const plan = planDccSourceZip(rows)

    const files: Record<string, Uint8Array> = {}
    const exportedEntries: DccSourceDownloadEntry[] = []
    const skipped: DccSourceSkipped[] = [...plan.skipped]

    for (const entry of plan.entries) {
      try {
        files[entry.zipPath] = await objectBytes(entry.sourcePath)
        exportedEntries.push(entry)
      } catch {
        const row = rows.find((draft) => draft.draftId === entry.draftId)
        skipped.push({
          draftId: entry.draftId,
          documentId: entry.documentId,
          documentCode: row?.documentCode ?? entry.documentId,
          title: row?.title ?? entry.fileName,
          reason: 'read-failed',
        })
      }
    }

    const finalPlan = finalPlanAfterReads(plan, exportedEntries, skipped)
    files['dcc-source-download-summary.txt'] = strToU8(buildDccSourceDownloadSummary(finalPlan))

    const zip = zipSync(files, { level: 6 })
    const filename = buildDccSourceDownloadFilename()

    return new NextResponse(zip, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': contentDispositionForDownload(filename),
        'Content-Length': String(zip.byteLength),
        'X-Exported-Files': String(finalPlan.entries.length),
        'X-Skipped-Files': String(finalPlan.skipped.length),
        'X-Matched-Drafts': String(finalPlan.matchedDrafts),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 422 })
  }
}
