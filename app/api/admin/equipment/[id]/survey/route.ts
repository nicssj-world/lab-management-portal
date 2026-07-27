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

const CONDITIONS = ['ok', 'ชำรุด', 'ไม่พบ', 'ย้าย'] as const

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const surveyed: boolean = body.surveyed === true
  const condition = typeof body.condition === 'string' && (CONDITIONS as readonly string[]).includes(body.condition) ? body.condition : null
  const note: string | null = typeof body.note === 'string' ? body.note : null

  const { data: round, error: roundError } = await supabaseAdmin
    .from('equipment_survey_rounds')
    .select('id')
    .is('closed_at', null)
    .maybeSingle()
  if (roundError) return NextResponse.json({ error: roundError.message }, { status: 500 })
  if (!round) return NextResponse.json({ error: 'ไม่มีรอบสำรวจที่เปิดอยู่ในขณะนี้' }, { status: 409 })

  if (!surveyed) {
    const { error } = await supabaseAdmin
      .from('equipment_survey_records')
      .delete()
      .eq('round_id', round.id)
      .eq('equipment_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, surveyed: false })
  }

  const { data, error } = await supabaseAdmin
    .from('equipment_survey_records')
    .upsert(
      { round_id: round.id, equipment_id: id, surveyed_by: actor.id, surveyed_at: new Date().toISOString(), condition, note },
      { onConflict: 'round_id,equipment_id' },
    )
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, surveyed: true, record: data })
}
