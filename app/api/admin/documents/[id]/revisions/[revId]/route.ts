import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

type Params = { params: Promise<{ id: string; revId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['Admin', 'Manager'].includes(actor.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { revId } = await params
  const body = await req.json()

  const updates: Record<string, unknown> = {}
  if (body.revision_number !== undefined) updates.revision_number = body.revision_number
  if (body.revised_by      !== undefined) updates.revised_by      = body.revised_by || null
  if (body.approved_by     !== undefined) updates.approved_by     = body.approved_by || null
  if (body.revision_note   !== undefined) updates.revision_note   = body.revision_note || null
  if (body.revision_date) {
    updates.created_at = new Date(body.revision_date).toISOString()
  }

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะอัปเดต' }, { status: 422 })

  const { data, error } = await supabaseAdmin
    .from('document_revisions')
    .update(updates)
    .eq('id', revId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['Admin', 'Manager'].includes(actor.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { revId } = await params

  const { error } = await supabaseAdmin
    .from('document_revisions')
    .delete()
    .eq('id', revId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
