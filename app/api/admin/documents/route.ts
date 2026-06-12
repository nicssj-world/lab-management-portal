import { supabaseAdmin } from '@/lib/supabase/admin'
import { DocumentSchema } from '@/lib/validations/document'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessDocuments, getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { canMoveToStatus, isCoverRequiredType, isPdfFile, isSourceFile } from '@/lib/documents/workflow'
import { isDocxFile, patchDocxHeaderMetadata, type DocxHeaderMetadata } from '@/lib/documents/docx-header'

function toMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

function isDuplicateDocumentCodeError(err: { code?: string; message?: string }) {
  return err.code === '23505'
    || (err.message ?? '').includes('documents_document_code_key')
}

const ALLOWED_SORT = new Set([
  'document_code',
  'title',
  'type',
  'status',
  'visibility',
  'department',
  'revision',
  'effective_date',
  'review_date',
  'created_at',
  'updated_at',
])

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(1, Math.trunc(parsed)), max)
}

function safeSearchTerm(value: string) {
  return value.replace(/[%,()]/g, ' ').trim().slice(0, 100)
}

async function uploadDocumentObject(file: File, type: string, prefix = '', headerMetadata?: DocxHeaderMetadata) {
  const year = new Date().getFullYear()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const r2Key = `documents/${type.toLowerCase()}/${year}/${Date.now()}-${prefix}${safeName}`
  let body: Buffer<ArrayBufferLike> = Buffer.from(await file.arrayBuffer())
  if (headerMetadata && isDocxFile(file)) {
    body = await patchDocxHeaderMetadata(body, headerMetadata)
  }
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    Body: body,
    ContentType: file.type || 'application/octet-stream',
  }))
  return { key: r2Key, size: body.length }
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getActor()
    if (!actor) return jsonUnauthorized()
    if (!(await canAccessDocuments(actor, 'view'))) return jsonForbidden()

    const sp = req.nextUrl.searchParams
    const type       = sp.get('type') ?? undefined
    const status     = actor.doc_role === 'Viewer' ? 'Published' : (sp.get('status') ?? undefined)
    const visibility = sp.get('visibility') ?? undefined
    const department = sp.get('department') ?? undefined
    const search     = safeSearchTerm(sp.get('search') ?? '')
    const page       = parsePositiveInt(sp.get('page'), 1, 100000)
    const pageSize   = parsePositiveInt(sp.get('pageSize'), 50, 200)
    const sortParam  = sp.get('sortBy') ?? 'updated_at'
    const sortBy     = ALLOWED_SORT.has(sortParam) ? sortParam : 'updated_at'
    const sortDir    = sp.get('sortDir') === 'asc' ? 'asc' : 'desc'

    const code = sp.get('code') ?? undefined

    let query = supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)

    if (code)                   query = query.eq('document_code', code.toUpperCase())
    if (type && type !== 'All') query = query.eq('type', type)
    if (status)                 query = query.eq('status', status)
    if (visibility)             query = query.eq('visibility', visibility)
    if (department)             query = query.eq('department', department)
    if (search) {
      query = query.or(`title.ilike.%${search}%,document_code.ilike.%${search}%`)
    }

    const from = (page - 1) * pageSize
    const { data, error, count } = await query
      .order(sortBy, { ascending: sortDir === 'asc' })
      .range(from, from + pageSize - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [], count: count ?? 0 })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()

  if (!(await canAccessDocuments(actor, 'edit'))) return jsonForbidden()

  try {
    const form = await req.formData()
    const fileRaw = form.get('file')
    const file = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null
    const wordRaw = form.get('word_file')
    const wordFile = wordRaw instanceof File && wordRaw.size > 0 ? wordRaw : null

    const metaRaw = form.get('meta')
    if (!metaRaw) return NextResponse.json({ error: 'ไม่พบข้อมูลเอกสาร' }, { status: 422 })

    const parsed = DocumentSchema.safeParse(JSON.parse(metaRaw as string))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
    }
    const meta = parsed.data
    const documentCode = meta.document_code.toUpperCase()

    if (file && file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'ไฟล์ทางการใหญ่เกิน 50 MB' }, { status: 422 })
    }
    if (wordFile && wordFile.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'ไฟล์ Word/Excel ใหญ่เกิน 50 MB' }, { status: 422 })
    }
    if (file && isCoverRequiredType(meta.type) && !isPdfFile(file)) {
      return NextResponse.json({ error: 'QP/WI ต้องใช้ PDF เนื้อหาในช่องไฟล์ทางการ' }, { status: 422 })
    }
    if (file && !isCoverRequiredType(meta.type) && !isPdfFile(file) && !isSourceFile(file)) {
      return NextResponse.json({ error: 'ไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
    }
    if (wordFile && !isSourceFile(wordFile)) {
      return NextResponse.json({ error: 'ไฟล์ต้นฉบับรองรับ DOC, DOCX, XLS, XLSX เท่านั้น' }, { status: 422 })
    }

    const { data: existingDoc, error: existingErr } = await supabaseAdmin
      .from('documents')
      .select('id, title, revision, deleted_at')
      .eq('document_code', documentCode)
      .maybeSingle()

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 })
    }

    if (existingDoc) {
      const deletedHint = existingDoc.deleted_at
        ? 'เอกสารรหัสนี้เคยถูกลบไว้แล้ว กรุณากู้คืน/ลบถาวรก่อน หรือใช้รหัสเอกสารอื่น'
        : 'รหัสเอกสารนี้มีอยู่ในระบบแล้ว หากต้องการอัปโหลดฉบับแก้ไข ให้เปิดเอกสารเดิมแล้วเพิ่ม Revision แทน'

      return NextResponse.json({
        error: `${deletedHint} (${documentCode}, Rev. ${existingDoc.revision})`,
        documentId: existingDoc.id,
      }, { status: 409 })
    }

    let officialFields: {
      file_url?: string | null
      file_name?: string | null
      file_size?: number | null
      mime_type?: string | null
      source_pdf_url?: string | null
      source_pdf_name?: string | null
      source_pdf_size?: number | null
      source_pdf_mime_type?: string | null
    } = {
      file_url: null,
      file_name: null,
      file_size: null,
      mime_type: null,
    }
    const uploadedKeys: string[] = []
    const resolvedEditDate = meta.edit_date || (wordFile ? new Date().toISOString().split('T')[0] : undefined)
    const headerMetadata: DocxHeaderMetadata = {
      documentCode,
      title: meta.title,
      revision: meta.revision,
      effectiveDate: meta.effective_date,
      reviewDate: meta.expiry_date,
      editDate: resolvedEditDate,
    }

    if (file) {
      const uploaded = await uploadDocumentObject(file, meta.type, '', headerMetadata)
      const r2Key = uploaded.key
      uploadedKeys.push(r2Key)
      officialFields = {
        file_url: r2Key,
        file_name: file.name,
        file_size: uploaded.size,
        mime_type: file.type || 'application/octet-stream',
        ...(isCoverRequiredType(meta.type)
          ? {
              source_pdf_url: r2Key,
              source_pdf_name: file.name,
              source_pdf_size: uploaded.size,
              source_pdf_mime_type: file.type || 'application/pdf',
            }
          : {}),
      }
    }

    let wordFields: { word_url?: string; word_name?: string; word_size?: number; edit_date?: string } = {}
    if (wordFile) {
      const uploaded = await uploadDocumentObject(wordFile, meta.type, 'source-', headerMetadata)
      const wordKey = uploaded.key
      uploadedKeys.push(wordKey)
      wordFields = {
        word_url: wordKey,
        word_name: wordFile.name,
        word_size: uploaded.size,
        edit_date: resolvedEditDate,
      }
    }

    const workflowCheck = canMoveToStatus(
      {
        type: meta.type,
        status: 'Draft',
        file_url: officialFields.file_url ?? null,
        source_pdf_url: officialFields.source_pdf_url ?? null,
      },
      meta.status,
    )
    if (!workflowCheck.ok) {
      for (const key of uploadedKeys) {
        r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => {})
      }
      return NextResponse.json({ error: workflowCheck.error }, { status: 422 })
    }

    const { data: doc, error: dbErr } = await supabaseAdmin
      .from('documents')
      .insert({
        ...meta,
        document_code: documentCode,
        owner_id:  actor.id,
        ...officialFields,
        ...wordFields,
      })
      .select()
      .single()

    if (dbErr) {
      // Best-effort cleanup on DB error
      for (const key of uploadedKeys) {
        r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => {})
      }
      if (isDuplicateDocumentCodeError(dbErr)) {
        return NextResponse.json({
          error: `รหัสเอกสารนี้มีอยู่ในระบบแล้ว (${documentCode}) หากต้องการอัปโหลดฉบับแก้ไข ให้เปิดเอกสารเดิมแล้วเพิ่ม Revision แทน`,
        }, { status: 409 })
      }
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    supabaseAdmin.from('document_access_logs')
      .insert({ document_id: doc.id, user_id: actor.id, action: 'upload' })
      .then(undefined, () => {})

    supabaseAdmin.from('audit_log').insert({
      action: 'document.upload',
      user_id: actor.id,
      target: doc.document_code,
      detail: `${doc.document_code} · ${doc.title}`,
    }).then(undefined, () => {})

    supabaseAdmin.from('document_status_history')
      .insert({
        document_id: doc.id,
        from_status: null,
        to_status: doc.status,
        changed_by: actor.id,
        changed_at: doc.created_at,
      })
      .then(undefined, () => {})

    return NextResponse.json(doc, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
