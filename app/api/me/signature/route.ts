import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActor, jsonUnauthorized } from '@/lib/auth/guards'
import {
  ensureSignatureBucket,
  MAX_SIGNATURE_BYTES,
  SIGNATURE_BUCKET,
  signatureExtForType,
  createSignatureSignedUrl,
} from '@/lib/signatures'

function canEditOwn(actor: { role: string; doc_role: string | null }) {
  return actor.role === 'Admin' || actor.role === 'Manager' || actor.doc_role === 'Reviewer'
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!canEditOwn(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 422 })

  const ext = signatureExtForType(file.type)
  if (!ext) return NextResponse.json({ error: 'รองรับเฉพาะ PNG, JPG หรือ WebP' }, { status: 415 })
  if (file.size > MAX_SIGNATURE_BYTES) {
    return NextResponse.json({ error: 'ไฟล์ลายเซ็นต้องไม่เกิน 2 MB' }, { status: 413 })
  }

  await ensureSignatureBucket()
  const { data: currentProfile } = await supabaseAdmin
    .from('profiles')
    .select('signature_url')
    .eq('id', actor.id)
    .single()
  const path = `${actor.id}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(SIGNATURE_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ signature_url: path, signature_updated_at: now, signature_updated_by: actor.id })
    .eq('id', actor.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (currentProfile?.signature_url && currentProfile.signature_url !== path) {
    supabaseAdmin.storage.from(SIGNATURE_BUCKET).remove([currentProfile.signature_url]).then(undefined, () => {})
  }

  supabaseAdmin.from('audit_log').insert({
    action: 'document_profile.signature_upload_self',
    user_id: actor.id,
    target: actor.id,
    detail: path,
  }).then(undefined, () => {})

  return NextResponse.json({ signature_url: path, signature_signed_url: await createSignatureSignedUrl(path) })
}

export async function DELETE() {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!canEditOwn(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('signature_url')
    .eq('id', actor.id)
    .single()

  if (data?.signature_url) {
    try {
      await supabaseAdmin.storage.from(SIGNATURE_BUCKET).remove([data.signature_url])
    } catch {}
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ signature_url: null, signature_updated_at: new Date().toISOString(), signature_updated_by: actor.id })
    .eq('id', actor.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'document_profile.signature_delete_self',
    user_id: actor.id,
    target: actor.id,
  }).then(undefined, () => {})

  return NextResponse.json({ ok: true })
}
