import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireIt, auditIt } from '@/lib/it-access/guard'
import { getItDowntimeLogs } from '@/lib/queries/it-access'
import { ItDowntimeSchema } from '@/lib/validations/it-access'

function endBeforeStart(started: string, ended: string | null | undefined) {
  return !!ended && new Date(ended).getTime() < new Date(started).getTime()
}

export async function GET() {
  const guard = await requireIt('view')
  if ('error' in guard) return guard.error
  const items = await getItDowntimeLogs(supabaseAdmin)
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const guard = await requireIt('edit')
  if ('error' in guard) return guard.error
  const actor = guard.actor

  const parsed = ItDowntimeSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }
  if (endBeforeStart(parsed.data.started_at, parsed.data.ended_at)) {
    return NextResponse.json({ error: 'เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม' }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('it_downtime_logs')
    .insert({ ...parsed.data, created_by: actor.id })
    .select('*, system:it_systems(name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const systemName = (data as { system?: { name?: string } }).system?.name ?? ''
  auditIt('it_downtime.create', actor.id, data.id, `${systemName} · ${parsed.data.ended_at ? 'ล่ม' : 'กำลังเกิดเหตุ'}`)
  return NextResponse.json(data, { status: 201 })
}
