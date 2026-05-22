import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

async function canEditDocuments(role: string) {
  const perms = await getRolePermissions(role)
  return (perms['เอกสารคุณภาพ'] ?? 'none') === 'edit'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('document_revisions')
    .select('*')
    .eq('document_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — manually insert a historical revision entry
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canEditDocuments(actor.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const form = await req.formData()
    const file           = form.get('file') as File | null
    const revisionNumber = (form.get('revision_number') as string ?? '').trim()
    const revisionNote   = (form.get('revision_note') as string ?? '').trim()
    const revisedBy      = (form.get('revised_by') as string ?? '').trim()
    const approvedBy     = (form.get('approved_by') as string ?? '').trim()
    const revisionDate   = (form.get('revision_date') as string ?? '').trim()

    if (!revisionNumber) {
      return NextResponse.json({ error: 'กรุณากรอกหมายเลข Revision' }, { status: 422 })
    }

    let fileUrl  = ''
    let fileName = ''

    if (file && file.size > 0) {
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 50 MB' }, { status: 422 })
      }

      const { data: doc } = await supabaseAdmin
        .from('documents').select('type').eq('id', id).single()

      const type = doc?.type ?? 'others'
      const year = revisionDate ? new Date(revisionDate).getFullYear() : new Date().getFullYear()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      fileUrl  = `documents/${type.toLowerCase()}/${year}/${Date.now()}-${safeName}`
      fileName = file.name

      const buffer = Buffer.from(await file.arrayBuffer())
      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: fileUrl,
        Body: buffer,
        ContentType: file.type,
      }))
    }

    const insertData: Record<string, unknown> = {
      document_id:     id,
      revision_number: revisionNumber,
      revision_note:   revisionNote || null,
      revised_by:      revisedBy || null,
      approved_by:     approvedBy || null,
      file_url:        fileUrl,
      file_name:       fileName,
      uploaded_by:     actor.id,
    }

    if (revisionDate) {
      insertData.created_at = new Date(revisionDate).toISOString()
    }

    const { data, error } = await supabaseAdmin
      .from('document_revisions')
      .insert(insertData)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
