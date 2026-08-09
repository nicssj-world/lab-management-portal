import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auditSafety, requireSafetyEditor } from '@/lib/lab-map/safety-access'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { syncSafetyInspectionRoundToTask } from '@/lib/quality-tasks/safety-server'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Context) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const parsed = z.object({ close: z.literal(true) }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })
  const { id } = await params
  const { count, error: pendingError } = await supabaseAdmin.from('lab_map_safety_inspection_round_items')
    .select('id', { count: 'exact', head: true }).eq('round_id', id).eq('status', 'pending')
  if (pendingError) return NextResponse.json({ error: pendingError.message }, { status: 500 })
  if ((count ?? 0) > 0) return NextResponse.json({ error: 'ยังมีอุปกรณ์ที่ไม่ได้ตรวจในรอบนี้' }, { status: 422 })

  const closedAt = new Date().toISOString()
  const { data, error } = await supabaseAdmin.from('lab_map_safety_inspection_rounds').update({
    status: 'closed', closed_by: guard.actor.id, closed_at: closedAt,
  }).eq('id', id).eq('started_by', guard.actor.id).eq('status', 'open').select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) {
    const { data: closedRound } = await supabaseAdmin.from('lab_map_safety_inspection_rounds').select('*').eq('id', id).eq('started_by', guard.actor.id).eq('status', 'closed').maybeSingle()
    if (!closedRound) return NextResponse.json({ error: 'ไม่พบรอบตรวจที่เปิดอยู่' }, { status: 404 })
    try {
      const taskSync = await syncSafetyInspectionRoundToTask(id, guard.actor)
      return NextResponse.json({ data: closedRound, taskSync, retried: true })
    } catch (syncError) {
      return NextResponse.json({ data: closedRound, taskSync: { status: 'pending', error: (syncError as Error).message } }, { status: 202 })
    }
  }
  try {
    await auditSafety('lab_map.safety_inspection_round.close', guard.actor.id, id, { status: 'closed', closedAt })
  } catch (auditError) {
    return NextResponse.json({ error: (auditError as Error).message }, { status: 500 })
  }
  try {
    const taskSync = await syncSafetyInspectionRoundToTask(id, guard.actor)
    return NextResponse.json({ data, taskSync })
  } catch (syncError) {
    return NextResponse.json({ data, taskSync: { status: 'pending', error: (syncError as Error).message } }, { status: 202 })
  }
}
