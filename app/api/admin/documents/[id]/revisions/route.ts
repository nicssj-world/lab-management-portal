import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getActor, jsonUnauthorized } from '@/lib/auth/guards'
import { generateRevisionHistoryPdfForDocument } from '@/lib/documents/revision-history-pdf'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

const MAX_HISTORY_FILE_SIZE = 50 * 1024 * 1024
const ALLOWED_HISTORY_FILE_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx'])

function canBackfillRevisionHistory(actor: { role: string; doc_role: string | null }) {
  return actor.role === 'Admin' || actor.role === 'Document Controller' || actor.doc_role === 'Document Controller'
}

function isAllowedHistoryFile(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ALLOWED_HISTORY_FILE_EXTENSIONS.has(ext)
}

function parseDateOnly(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  if (!text) return new Date().toISOString()
  return new Date(`${text}T00:00:00.000Z`).toISOString()
}

async function uploadHistoryFile(file: File, documentId: string) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `documents/revisions/backfill/${documentId}/${Date.now()}-${safeName}`
  const body = Buffer.from(await file.arrayBuffer())
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: file.type || 'application/octet-stream',
  }))
  return { key, size: body.length }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()

  const { id } = await params
  if (req.nextUrl.searchParams.get('format') === 'pdf') {
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('documents')
      .select('id, document_code')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const pdf = await generateRevisionHistoryPdfForDocument(id)
    const safeCode = String(doc.document_code ?? id).replace(/[^a-zA-Z0-9._-]/g, '_')
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeCode || 'revision-history'}-revision-history.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const { data, error } = await supabaseAdmin
    .from('document_revisions')
    .select('*')
    .eq('document_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!canBackfillRevisionHistory(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  try {
    const form = await req.formData()
    const revisionNumber = String(form.get('revision_number') ?? '').trim()
    if (!revisionNumber) {
      return NextResponse.json({ error: 'กรุณากรอกหมายเลข Revision' }, { status: 422 })
    }

    const fileRaw = form.get('file')
    const file = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null
    let fileFields: Record<string, unknown> = {
      file_url: null,
      file_name: null,
      file_size: null,
      mime_type: null,
    }

    if (file) {
      if (file.size > MAX_HISTORY_FILE_SIZE) {
        return NextResponse.json({ error: 'ไฟล์ประวัติย้อนหลังใหญ่เกิน 50 MB' }, { status: 422 })
      }
      if (!isAllowedHistoryFile(file)) {
        return NextResponse.json({ error: 'ไฟล์ประวัติย้อนหลังรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
      }
      const uploaded = await uploadHistoryFile(file, id)
      fileFields = {
        file_url: uploaded.key,
        file_name: file.name,
        file_size: uploaded.size,
        mime_type: file.type || 'application/octet-stream',
      }
    }

    const payload = {
      document_id: id,
      revision_number: revisionNumber,
      revision_note: String(form.get('revision_note') ?? '').trim() || null,
      revised_by: String(form.get('revised_by') ?? '').trim() || null,
      approved_by: String(form.get('approved_by') ?? '').trim() || null,
      uploaded_by: actor.id,
      created_at: parseDateOnly(form.get('revision_date')),
      history_source: 'backfill',
      ...fileFields,
    }

    const { data, error } = await supabaseAdmin
      .from('document_revisions')
      .insert(payload)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    supabaseAdmin.from('audit_log').insert({
      action: 'document.revision_history_backfill_create',
      user_id: actor.id,
      target: `${id}:${data.id}`,
      detail: `Backfilled Rev. ${revisionNumber}`,
    }).then(undefined, () => {})

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
