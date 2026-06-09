import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { DocumentSchema } from '@/lib/validations/document'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role, doc_role').eq('id', user.id).single()
  return data as { id: string; role: string; doc_role: string | null } | null
}

function toMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

const DOC_UPLOAD_ROLES = ['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer']
const DOC_DELETE_ROLES = ['Laboratory Director', 'Document Controller']

async function canUploadDocument(role: string, docRole: string | null) {
  if (role === 'Admin') return true
  if (DOC_UPLOAD_ROLES.includes(docRole ?? role)) return true
  const perms = await getRolePermissions(role)
  return (perms['เอกสารคุณภาพ'] ?? 'none') === 'edit'
}

function canDeleteDocument(role: string, docRole: string | null) {
  if (role === 'Admin') return true
  return DOC_DELETE_ROLES.includes(docRole ?? role)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await canUploadDocument(actor.role, actor.doc_role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const contentType = req.headers.get('content-type') ?? ''
    let updates: Record<string, unknown> = {}
    let newFile: File | null = null

    let newWordFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      newFile = form.get('file') as File | null
      newWordFile = form.get('word_file') as File | null

      const metaRaw = form.get('meta')
      if (metaRaw) {
        const parsed = DocumentSchema.partial().safeParse(JSON.parse(metaRaw as string))
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 })
        }
        updates = parsed.data as Record<string, unknown>
      }
    } else {
      const body = await req.json()
      const parsed = DocumentSchema.partial().safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 })
      }
      updates = parsed.data as Record<string, unknown>
    }

    // Always fetch current doc (needed for revision history + R2 key)
    const { data: current } = await supabaseAdmin
      .from('documents')
      .select('file_url, file_name, revision, type, description, owner_name, approver_name, status, document_code, title')
      .eq('id', id)
      .single()

    if (newFile) {
      if (newFile.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 50 MB' }, { status: 422 })
      }

      const type = (updates.type as string) ?? current?.type ?? 'others'
      const year = new Date().getFullYear()
      const safeName = newFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const r2Key = `documents/${type.toLowerCase()}/${year}/${Date.now()}-${safeName}`

      const buffer = Buffer.from(await newFile.arrayBuffer())
      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2Key,
        Body: buffer,
        ContentType: newFile.type,
      }))

      updates.file_url  = r2Key
      updates.file_name = newFile.name
      updates.file_size = newFile.size
      updates.mime_type = newFile.type
    }

    if (newWordFile && newWordFile.size > 0) {
      if (newWordFile.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'ไฟล์ Word/Excel ใหญ่เกิน 50 MB' }, { status: 422 })
      }
      const type = (updates.type as string) ?? current?.type ?? 'others'
      const year = new Date().getFullYear()
      const safeWordName = newWordFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const wordKey = `documents/${type.toLowerCase()}/${year}/${Date.now()}-word-${safeWordName}`
      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: wordKey,
        Body: Buffer.from(await newWordFile.arrayBuffer()),
        ContentType: newWordFile.type,
      }))
      updates.word_url  = wordKey
      updates.word_name = newWordFile.name
      updates.word_size = newWordFile.size
    }

    // Save old revision to history when revision number changes OR file is replaced
    const skipRevision = req.nextUrl.searchParams.get('skipRevision') === '1'
    const revisionChanged = updates.revision !== undefined && updates.revision !== current?.revision
    if (!skipRevision && (revisionChanged || newFile) && current?.file_url) {
      supabaseAdmin.from('document_revisions').insert({
        document_id:     id,
        revision_number: current.revision ?? '1',
        revision_note:   current.description ?? null,
        revised_by:      current.owner_name ?? null,
        approved_by:     current.approver_name ?? null,
        file_url:        current.file_url,
        file_name:       current.file_name ?? '',
        uploaded_by:     actor.id,
      }).then(undefined, () => {})
    }

    // Auto-set obsolete_date when transitioning to Obsolete; clear when leaving Obsolete
    const newStatus = (updates as Record<string, unknown>).status
    if (newStatus === 'Obsolete') {
      if (!(updates as Record<string, unknown>).obsolete_date) {
        (updates as Record<string, unknown>).obsolete_date = new Date().toISOString().split('T')[0]
      }
    } else if (newStatus && newStatus !== 'Obsolete') {
      (updates as Record<string, unknown>).obsolete_date   = null
      ;(updates as Record<string, unknown>).obsolete_reason = null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะอัปเดต' }, { status: 422 })
    }

    const { data: doc, error: dbErr } = await supabaseAdmin
      .from('documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    if (typeof newStatus === 'string' && newStatus !== current?.status) {
      supabaseAdmin.from('document_status_history')
        .insert({
          document_id: id,
          from_status: current?.status ?? null,
          to_status: newStatus,
          changed_by: actor.id,
        })
        .then(undefined, () => {})
    }

    supabaseAdmin.from('document_access_logs')
      .insert({ document_id: id, user_id: actor.id, action: 'edit' })
      .then(undefined, () => {})

    const auditAction = (typeof newStatus === 'string' && newStatus !== current?.status) ? 'document.status_change' : 'document.edit'
    const auditDetail = auditAction === 'document.status_change'
      ? `${doc.document_code} · ${current?.status ?? '?'} → ${newStatus}`
      : `${doc.document_code} · ${doc.title}`
    supabaseAdmin.from('audit_log').insert({
      action: auditAction,
      user_id: actor.id,
      target: doc.document_code,
      detail: auditDetail,
    }).then(undefined, () => {})

    return NextResponse.json(doc)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canDeleteDocument(actor.role, actor.doc_role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const { data: deletedDoc, error: dbErr } = await supabaseAdmin
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('document_code, title')
      .single()

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    supabaseAdmin.from('document_access_logs')
      .insert({ document_id: id, user_id: actor.id, action: 'delete' })
      .then(undefined, () => {})

    supabaseAdmin.from('audit_log').insert({
      action: 'document.delete',
      user_id: actor.id,
      target: deletedDoc?.document_code ?? id,
      detail: deletedDoc ? `${deletedDoc.document_code} · ${deletedDoc.title}` : id,
    }).then(undefined, () => {})

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
