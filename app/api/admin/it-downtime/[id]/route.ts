import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireIt, auditIt } from '@/lib/it-access/guard'
import { ItDowntimeUpdateSchema } from '@/lib/validations/it-access'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireIt('edit')
  if ('error' in guard) return guard.error
  const actor = guard.actor
  const { id } = await params

  const parsed = ItDowntimeUpdateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const { data: before } = await supabaseAdmin
    .from('it_downtime_logs').select('started_at').eq('id', id).single()
  const started = parsed.data.started_at ?? before?.started_at
  const ended = parsed.data.ended_at
  if (started && ended && new Date(ended).getTime() < new Date(started).getTime()) {
    return NextResponse.json({ error: 'เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม' }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('it_downtime_logs').update(parsed.data).eq('id', id)
    .select('*, system:it_systems(name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const systemName = (data as { system?: { name?: string } }).system?.name ?? ''
  auditIt('it_downtime.update', actor.id, id, systemName)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireIt('edit')
  if ('error' in guard) return guard.error
  const actor = guard.actor
  const { id } = await params

  const { error } = await supabaseAdmin.from('it_downtime_logs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  auditIt('it_downtime.delete', actor.id, id, 'ลบบันทึกระบบล่ม')
  return NextResponse.json({ ok: true })
}
