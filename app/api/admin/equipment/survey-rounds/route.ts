import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPermissionsWithEquipmentOverride } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') === 'none')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('equipment_survey_rounds')
    .select('*')
    .order('started_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const nameTh = typeof body.nameTh === 'string' ? body.nameTh.trim() : ''
  if (!nameTh) return NextResponse.json({ error: 'กรุณาระบุชื่อรอบสำรวจ' }, { status: 422 })

  const { data, error } = await supabaseAdmin
    .from('equipment_survey_rounds')
    .insert({ name_th: nameTh, note: body.note ?? null, created_by: actor.id })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'มีรอบสำรวจที่เปิดอยู่แล้ว กรุณาปิดรอบเดิมก่อนเปิดรอบใหม่' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  supabaseAdmin.from('audit_log').insert({
    action: 'equipment.survey_round.open',
    user_id: actor.id,
    target: data.id,
    detail: nameTh,
  }).then(undefined, () => {})
  return NextResponse.json(data, { status: 201 })
}
