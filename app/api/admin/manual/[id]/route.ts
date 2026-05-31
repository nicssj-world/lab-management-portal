import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('manual_sections')
    .select('id, body_html_th, body_html_en, updated_at')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['Admin', 'Manager'].includes(actor.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { body_html_th, body_html_en } = body as { body_html_th?: string; body_html_en?: string }

  const { data, error } = await supabaseAdmin
    .from('manual_sections')
    .upsert({ id, body_html_th, body_html_en, updated_at: new Date().toISOString(), updated_by: actor.id })
    .select('id, body_html_th, body_html_en, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'manual_edit', user_id: actor.id, target: id,
    detail: `แก้ไขคู่มือ section: ${id}`,
  }).then(undefined, () => {})

  return NextResponse.json(data)
}
