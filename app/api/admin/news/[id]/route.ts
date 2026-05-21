import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NewsSchema } from '@/lib/validations/news'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

function toMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const canEdit = ['Admin', 'Manager'].includes(actor.role)
  if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  try {
    // Fetch current row for PDF cleanup
    const { data: current } = await supabaseAdmin
      .from('news').select('*').eq('id', id).single()
    if (!current) return NextResponse.json({ error: 'ไม่พบข่าวสาร' }, { status: 404 })

    const contentType = req.headers.get('content-type') ?? ''
    let updates: Record<string, unknown> = {}
    let pdfFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      pdfFile = form.get('pdf') as File | null

      const metaRaw = form.get('meta')
      if (metaRaw) {
        const parsed = NewsSchema.partial().safeParse(JSON.parse(metaRaw as string))
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 })
        }
        const { removePdf, ...rest } = parsed.data
        updates = rest as Record<string, unknown>

        if (removePdf && current.pdf_path) {
          r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: current.pdf_path })).catch(() => {})
          updates.pdf_path = null
        }
      }
    } else {
      const body = await req.json()
      const parsed = NewsSchema.partial().safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 })
      }
      const { removePdf, ...rest } = parsed.data
      updates = rest as Record<string, unknown>

      if (removePdf && current.pdf_path) {
        r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: current.pdf_path })).catch(() => {})
        updates.pdf_path = null
      }
    }

    // Upload new PDF if provided
    if (pdfFile && pdfFile.size > 0) {
      if (pdfFile.size > 20 * 1024 * 1024) {
        return NextResponse.json({ error: 'ไฟล์ PDF ใหญ่เกิน 20 MB' }, { status: 422 })
      }

      const safeName = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const r2Key = `news/${id}/${Date.now()}-${safeName}`
      const buffer = Buffer.from(await pdfFile.arrayBuffer())
      try {
        await r2.send(new PutObjectCommand({
          Bucket: R2_BUCKET, Key: r2Key, Body: buffer, ContentType: 'application/pdf',
        }))
      } catch {
        return NextResponse.json({ error: 'อัปโหลด PDF ไม่สำเร็จ' }, { status: 500 })
      }
      // Delete old PDF only after new one is safely uploaded
      if (current.pdf_path) {
        r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: current.pdf_path })).catch(() => {})
      }
      updates.pdf_path = r2Key
    }

    updates.updated_at = new Date().toISOString()

    const { data: updated, error: dbErr } = await supabaseAdmin
      .from('news')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    supabaseAdmin.from('audit_log')
      .insert({ action: 'update_news', user_id: actor.id, target: id, detail: updated.title })
      .then(undefined, () => {})

    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const canEdit = ['Admin', 'Manager'].includes(actor.role)
  if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  try {
    const { data: current } = await supabaseAdmin
      .from('news').select('id, title, pdf_path').eq('id', id).single()
    if (!current) return NextResponse.json({ error: 'ไม่พบข่าวสาร' }, { status: 404 })

    // Delete PDF from R2 (best-effort)
    if (current.pdf_path) {
      r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: current.pdf_path })).catch(() => {})
    }

    const { error } = await supabaseAdmin.from('news').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    supabaseAdmin.from('audit_log')
      .insert({ action: 'delete_news', user_id: actor.id, target: id, detail: current.title })
      .then(undefined, () => {})

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
