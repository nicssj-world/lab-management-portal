import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canManageDocumentProfile } from '@/lib/documents/workflow'
import { getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import {
  createSignatureSignedUrl,
  ensureSignatureBucket,
  normalizeSignatureImage,
  SIGNATURE_BUCKET,
} from '@/lib/signatures'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  const { id } = await params
  if (!canManageDocumentProfile(actor, id)) return jsonForbidden()

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 422 })

  let normalized: Awaited<ReturnType<typeof normalizeSignatureImage>>
  try {
    normalized = await normalizeSignatureImage(file)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'ไฟล์ลายเซ็นไม่ถูกต้อง' }, { status: 422 })
  }

  await ensureSignatureBucket()
  const { data: currentProfile } = await supabaseAdmin
    .from('profiles')
    .select('signature_url')
    .eq('id', id)
    .single()
  const path = `${id}.${normalized.ext}`
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(SIGNATURE_BUCKET)
    .upload(path, normalized.buffer, { contentType: normalized.contentType, upsert: true })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ signature_url: path, signature_updated_at: now, signature_updated_by: actor.id })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (currentProfile?.signature_url && currentProfile.signature_url !== path) {
    supabaseAdmin.storage.from(SIGNATURE_BUCKET).remove([currentProfile.signature_url]).then(undefined, () => {})
  }

  supabaseAdmin.from('audit_log').insert({
    action: 'document_profile.signature_upload',
    user_id: actor.id,
    target: id,
    detail: `${path} · normalized ${normalized.width}x${normalized.height}`,
  }).then(undefined, () => {})

  return NextResponse.json({ signature_url: path, signature_signed_url: await createSignatureSignedUrl(path) })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  const { id } = await params
  if (!canManageDocumentProfile(actor, id)) return jsonForbidden()

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('signature_url')
    .eq('id', id)
    .single()

  if (data?.signature_url) {
    try {
      await supabaseAdmin.storage.from(SIGNATURE_BUCKET).remove([data.signature_url])
    } catch {}
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ signature_url: null, signature_updated_at: new Date().toISOString(), signature_updated_by: actor.id })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'document_profile.signature_delete',
    user_id: actor.id,
    target: id,
  }).then(undefined, () => {})

  return NextResponse.json({ ok: true })
}
