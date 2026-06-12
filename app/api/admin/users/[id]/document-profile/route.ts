import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canManageDocumentProfile } from '@/lib/documents/workflow'
import { getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { documentProfileSchema } from '@/lib/validations/user-schema'
import { createSignatureSignedUrl } from '@/lib/signatures'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  const { id } = await params
  if (!canManageDocumentProfile(actor, id)) return jsonForbidden()

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, role, doc_role, document_position, signature_url, signature_updated_at')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    ...data,
    signature_signed_url: await createSignatureSignedUrl(data.signature_url),
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  const { id } = await params
  if (!canManageDocumentProfile(actor, id)) return jsonForbidden()

  const parsed = documentProfileSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 422 })
  }

  const updates: Record<string, unknown> = {}
  if ('document_position' in parsed.data) {
    updates.document_position = parsed.data.document_position?.trim() || null
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select('id, name, role, doc_role, document_position, signature_url, signature_updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'document_profile.update',
    user_id: actor.id,
    target: id,
    detail: Object.keys(updates).join(', '),
  }).then(undefined, () => {})

  return NextResponse.json({
    ...data,
    signature_signed_url: await createSignatureSignedUrl(data.signature_url),
  })
}
