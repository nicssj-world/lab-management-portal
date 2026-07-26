import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { manualPublicationInputSchema } from '@/lib/manual/control'

const SELECT = 'id, document_code, revision, revision_date, effective_date, reviewed_at, revised_by_name, approved_by_name, updated_at'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('manual_publication')
    .select(SELECT)
    .eq('id', 'main')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!['Admin', 'Manager'].includes(actor.role)) return jsonForbidden()

  const parsed = manualPublicationInputSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }
  const { reviewed_at: _ignoredReviewedAt, ...controlInput } = parsed.data

  const { data, error } = await supabaseAdmin
    .from('manual_publication')
    .upsert({
      id: 'main',
      ...controlInput,
      updated_at: new Date().toISOString(),
      updated_by: actor.id,
    })
    .select(SELECT)
    .single()

  if (error) {
    const status = error.code === '42P01' ? 503 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  // The database trigger synchronizes the current revision-history row with
  // document-controlled fields only. Section publication updates reviewed_at
  // separately and cannot overwrite the document revision record.

  supabaseAdmin.from('audit_log').insert({
    action: 'manual_edit', user_id: actor.id, target: 'manual-publication',
    detail: `ปรับข้อมูลควบคุมคู่มือออนไลน์ Rev. ${parsed.data.revision}`,
  }).then(undefined, () => {})

  return NextResponse.json(data)
}
