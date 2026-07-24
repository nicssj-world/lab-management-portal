import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requirePersonnelManage } from '@/lib/auth/guards'
import { ExamAssignSchema } from '@/lib/personnel/exam'

type Params = { params: Promise<{ examId: string }> }

// Assign an exam to many staff at once (one open assignment per person).
export async function POST(req: NextRequest, { params }: Params) {
  const { actor, response } = await requirePersonnelManage()
  if (!actor) return response
  const { examId } = await params
  const parsed = ExamAssignSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }
  const ids = [...new Set(parsed.data.profileIds)]
  const rows = ids.map((profileId) => ({ exam_id: examId, profile_id: profileId, assigned_by: actor.id }))
  // Ignore people already assigned this exam (unique exam_id, profile_id).
  const { error } = await supabaseAdmin.from('exam_assignments').upsert(rows, { onConflict: 'exam_id,profile_id', ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log')
    .insert({ action: 'personnel.exam.assign', user_id: actor.id, target: examId, detail: `${ids.length} คน` })
    .then(undefined, () => {})

  return NextResponse.json({ ok: true, count: ids.length })
}
