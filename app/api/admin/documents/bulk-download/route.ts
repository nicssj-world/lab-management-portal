import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { zipSync, strToU8 } from 'fflate'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import {
  buildBulkDownloadFilename,
  buildBulkDownloadQuery,
  buildDownloadSummary,
  canUseBulkDocumentDownload,
  planDocumentZip,
  type BulkDownloadDocument,
  type BulkDownloadFilters,
  type BulkDownloadKind,
} from '@/lib/documents/bulk-download'
import { contentDispositionForDownload } from '@/lib/documents/download-filename'

type Payload = BulkDownloadFilters & {
  kind?: string
}

const SELECT_COLUMNS = [
  'id',
  'document_code',
  'title',
  'type',
  'department',
  'status',
  'visibility',
  'file_url',
  'file_name',
  'file_size',
  'word_url',
  'word_name',
  'word_size',
].join(', ')

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function parseKind(value: string | undefined): BulkDownloadKind | null {
  if (value === 'pdf' || value === 'source' || value === 'both') return value
  return null
}

function safeSearchTerm(value: string | null | undefined) {
  return value?.replace(/[%,()]/g, ' ').trim().slice(0, 100) || undefined
}

async function objectBytes(path: string) {
  const result = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: path }))
  const body = result.Body
  if (!body || typeof body.transformToByteArray !== 'function') {
    throw new Error(`อ่านไฟล์จากคลังไม่สำเร็จ: ${path}`)
  }
  return Buffer.from(await body.transformToByteArray())
}

export async function POST(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!canUseBulkDocumentDownload(actor)) return jsonForbidden()

  let payload: Payload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 422 })
  }

  const kind = parseKind(payload.kind)
  if (!kind) return NextResponse.json({ error: 'กรุณาเลือกชนิดไฟล์ที่จะดาวน์โหลด' }, { status: 422 })

  const filters: BulkDownloadFilters = {
    type: payload.type,
    department: payload.department,
    search: safeSearchTerm(payload.search),
    visibility: payload.visibility,
  }
  const queryFilters = buildBulkDownloadQuery(filters)

  try {
    let query = supabaseAdmin
      .from('documents')
      .select(SELECT_COLUMNS)
      .is('deleted_at', null)
      .eq('status', 'Published')

    if (queryFilters.type) query = query.eq('type', queryFilters.type)
    if (queryFilters.department) query = query.eq('department', queryFilters.department)
    if (queryFilters.visibility) query = query.eq('visibility', queryFilters.visibility)
    if (queryFilters.search) {
      query = query.or(`title.ilike.%${queryFilters.search}%,document_code.ilike.%${queryFilters.search}%`)
    }

    const { data, error } = await query
      .order('document_code', { ascending: true })
      .limit(101)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = ((data ?? []) as unknown) as BulkDownloadDocument[]
    const plan = planDocumentZip(rows, { kind })

    const files: Record<string, Uint8Array> = {}
    for (const entry of plan.entries) {
      files[entry.zipPath] = await objectBytes(entry.sourcePath)
    }
    files['download-summary.txt'] = strToU8(buildDownloadSummary(plan, filters))

    const zip = zipSync(files, { level: 6 })
    const filename = buildBulkDownloadFilename(filters)

    return new NextResponse(zip, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': contentDispositionForDownload(filename),
        'Content-Length': String(zip.byteLength),
        'X-Exported-Files': String(plan.entries.length),
        'X-Skipped-Files': String(plan.skipped.length),
        'X-Matched-Documents': String(plan.matchedDocuments),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 422 })
  }
}
