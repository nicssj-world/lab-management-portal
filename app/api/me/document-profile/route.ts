import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActor, jsonUnauthorized } from '@/lib/auth/guards'
import { documentProfileSchema } from '@/lib/validations/user-schema'
import { createSignatureSignedUrl } from '@/lib/signatures'

function canEditOwn(actor: { role: string; doc_role: string | null }) {
  return actor.role === 'Admin' || actor.role === 'Manager' || actor.doc_role === 'Reviewer'
}

export async function GET() {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, role, doc_role, document_position, signature_url, signature_updated_at')
    .eq('id', actor.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const signature_signed_url = await createSignatureSignedUrl(data.signature_url)
  return NextResponse.json({ ...data, signature_signed_url })
}

export async function PATCH(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!canEditOwn(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = documentProfileSchema.safeParse(body)
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
    .eq('id', actor.id)
    .select('id, name, role, doc_role, document_position, signature_url, signature_updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'document_profile.update_self',
    user_id: actor.id,
    target: actor.id,
    detail: Object.keys(updates).join(', '),
  }).then(undefined, () => {})

  const signature_signed_url = await createSignatureSignedUrl(data.signature_url)
  return NextResponse.json({ ...data, signature_signed_url })
}
