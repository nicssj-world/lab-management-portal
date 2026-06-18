import { supabaseAdmin } from '@/lib/supabase/admin'
import { DocumentSchema } from '@/lib/validations/document'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessDocuments, getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { canMoveToStatus, isCoverRequiredType, isPdfFile, isSourceFile } from '@/lib/documents/workflow'
import { isDocxFile, patchDocxHeaderMetadata, type DocxHeaderMetadata } from '@/lib/documents/docx-header'
import { isXlsxFile, patchXlsxHeaderMetadata } from '@/lib/documents/xlsx-header'
import { buildDocxHeaderMetadata } from '@/lib/documents/metadata'
import { resolveDocumentSortColumn } from '@/lib/documents/sort'
import { stampPublishedPdfFooter } from '@/lib/documents/date-inject'

function toMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

function isDuplicateDocumentCodeError(err: { code?: string; message?: string }) {
  return err.code === '23505'
    || (err.message ?? '').includes('documents_document_code_key')
}

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(1, Math.trunc(parsed)), max)
}

function safeSearchTerm(value: string) {
  return value.replace(/[%,()]/g, ' ').trim().slice(0, 100)
}

function todayIsoDate() {
  return new Date().toISOString().split('T')[0]
}

function parseDateOnly(value: string | null | undefined) {
  const clean = value?.trim()
  if (!clean) return null
  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const parsed = new Date(clean)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function canImportCurrentDocument(actor: { role: string; doc_role?: string | null }) {
  return actor.role === 'Admin' || actor.role === 'Document Controller' || actor.doc_role === 'Document Controller'
}

function canViewSourceUploadQueue(actor: { role: string; doc_role?: string | null }) {
  return actor.role === 'Admin' || actor.role === 'Document Controller' || actor.doc_role === 'Document Controller'
}

async function uploadDocumentObject(
  file: File,
  type: string,
  prefix = '',
  headerMetadata?: DocxHeaderMetadata,
  bodyTransform?: (body: Buffer<ArrayBufferLike>) => Promise<Buffer<ArrayBufferLike>>,
) {
  const year = new Date().getFullYear()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const r2Key = `documents/${type.toLowerCase()}/${year}/${Date.now()}-${prefix}${safeName}`
  let body: Buffer<ArrayBufferLike> = Buffer.from(await file.arrayBuffer())
  if (headerMetadata) {
    if (isDocxFile(file)) {
      body = await patchDocxHeaderMetadata(body, headerMetadata)
    } else if (isXlsxFile(file)) {
      body = await patchXlsxHeaderMetadata(body, headerMetadata)
    }
  }
  if (bodyTransform) body = await bodyTransform(body)
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
    const sortBy     = resolveDocumentSortColumn(sp.get('sortBy'))
    const sortDir    = sp.get('sortDir') === 'asc' ? 'asc' : 'desc'
    const sourceUploadedOnly = sp.get('sourceUploaded') === '1'

    const code = sp.get('code') ?? undefined

    let sourceUploadedDocumentIds: string[] | null = null
    if (sourceUploadedOnly) {
      if (!canViewSourceUploadQueue(actor)) return jsonForbidden()

      const { data: sourceDrafts, error: sourceDraftsErr } = await supabaseAdmin
        .from('document_revision_drafts')
        .select('document_id')
        .is('cancelled_at', null)
        .neq('status', 'Published')
        .not('word_url', 'is', null)

      if (sourceDraftsErr) {
        return NextResponse.json({ error: sourceDraftsErr.message }, { status: 500 })
      }

      sourceUploadedDocumentIds = Array.from(new Set((sourceDrafts ?? []).map((row) => row.document_id).filter(Boolean)))
      if (sourceUploadedDocumentIds.length === 0) {
        return NextResponse.json({ data: [], count: 0 })
      }
    }

    let query = supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)

    if (sourceUploadedDocumentIds) query = query.in('id', sourceUploadedDocumentIds)
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
    const { import_mode: importMode, ...meta } = parsed.data
    const isImportCurrent = importMode === 'current'
    if (isImportCurrent && !canImportCurrentDocument(actor)) {
      return NextResponse.json({ error: 'เฉพาะ Admin หรือ Document Controller เท่านั้นที่นำเข้าเอกสารเดิมเป็น Published ได้' }, { status: 403 })
    }
    if (!isImportCurrent && meta.status !== 'Draft') {
      return NextResponse.json({ error: 'เอกสารใหม่ต้องเริ่มที่สถานะ Draft' }, { status: 422 })
    }
    if (isImportCurrent && meta.status !== 'Published') {
      return NextResponse.json({ error: 'โหมดนำเข้าเอกสารเดิมต้องสร้างเป็นสถานะ Published' }, { status: 422 })
    }
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
    if (isImportCurrent && !file) {
      return NextResponse.json({ error: 'โหมดนำเข้าเอกสารเดิม Rev.>0 ต้องแนบไฟล์ทางการ Rev ปัจจุบัน' }, { status: 422 })
    }
    if (isImportCurrent && isCoverRequiredType(meta.type) && !meta.legacy_cover_included) {
      return NextResponse.json({ error: 'QP/WI ที่นำเข้าเป็น Rev.>0 ต้องใช้ PDF ทางการเดิมที่มีหน้าปกอยู่แล้ว หากเป็น PDF เนื้อหาไม่มีหน้าปกให้ใช้ Flow Draft ปกติ' }, { status: 422 })
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
    const now = new Date().toISOString()
    const editReviewDate = wordFile && !isImportCurrent ? todayIsoDate() : (meta.edit_date || meta.expiry_date)
    const resolvedMeta = {
      ...meta,
      owner_name: meta.owner_name || (wordFile ? actor.name ?? undefined : meta.owner_name),
      edit_date: editReviewDate,
      expiry_date: editReviewDate,
      ...(isImportCurrent
        ? {
            status: 'Published',
            published_at: now,
            published_by_id: actor.id,
            effective_date: meta.effective_date || todayIsoDate(),
            imported_current_at: now,
            imported_current_by: actor.id,
            imported_current_note: meta.imported_current_note || null,
            legacy_cover_included: Boolean(meta.legacy_cover_included),
            cover_metadata: meta.legacy_cover_included
              ? {
                  reason: 'import_current_pdf_has_existing_cover',
                }
              : undefined,
          }
        : {}),
    }
    const headerMetadata: DocxHeaderMetadata = buildDocxHeaderMetadata({
      ...resolvedMeta,
      document_code: documentCode,
    })

    if (file) {
      const shouldStampImportedLegacyPdf =
        isImportCurrent &&
        isCoverRequiredType(meta.type) &&
        Boolean(resolvedMeta.legacy_cover_included) &&
        isPdfFile(file)
      const importedEffectiveDate = shouldStampImportedLegacyPdf
        ? parseDateOnly(resolvedMeta.effective_date ?? null)
        : null
      const uploaded = await uploadDocumentObject(
        file,
        meta.type,
        '',
        headerMetadata,
        importedEffectiveDate
          ? (body) => stampPublishedPdfFooter(body, documentCode, meta.revision, importedEffectiveDate)
          : undefined,
      )
      const r2Key = uploaded.key
      uploadedKeys.push(r2Key)
      officialFields = {
        file_url: r2Key,
        file_name: file.name,
        file_size: uploaded.size,
        mime_type: file.type || 'application/octet-stream',
        ...(isCoverRequiredType(meta.type) && !resolvedMeta.legacy_cover_included
          ? {
              source_pdf_url: r2Key,
              source_pdf_name: file.name,
              source_pdf_size: uploaded.size,
              source_pdf_mime_type: file.type || 'application/pdf',
            }
          : {}),
      }
    }

    let wordFields: { word_url?: string; word_name?: string; word_size?: number } = {}
    if (wordFile) {
      const uploaded = await uploadDocumentObject(wordFile, meta.type, 'source-', headerMetadata)
      const wordKey = uploaded.key
      uploadedKeys.push(wordKey)
      wordFields = {
        word_url: wordKey,
        word_name: wordFile.name,
        word_size: uploaded.size,
      }
    }

    const workflowCheck = canMoveToStatus(
      {
        type: meta.type,
        status: 'Draft',
        file_url: officialFields.file_url ?? null,
        source_pdf_url: officialFields.source_pdf_url ?? null,
        word_url: wordFields.word_url ?? null,
      },
      'Draft',
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
        ...resolvedMeta,
        document_code: documentCode,
        status: 'Draft',
        ...(isImportCurrent ? { status: 'Published' } : {}),
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
      action: isImportCurrent ? 'document.import_current' : 'document.upload',
      user_id: actor.id,
      target: doc.document_code,
      detail: isImportCurrent
        ? `${doc.document_code} · imported current Rev. ${doc.revision}${doc.legacy_cover_included ? ' · legacy cover included' : ''}`
        : `${doc.document_code} · ${doc.title}`,
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
