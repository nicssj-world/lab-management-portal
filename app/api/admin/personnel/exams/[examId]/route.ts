import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requirePersonnelManage } from '@/lib/auth/guards'
import { ExamUpsertSchema, type ExamDefinition } from '@/lib/personnel/exam'

type Params = { params: Promise<{ examId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { actor, response } = await requirePersonnelManage()
  if (!actor) return response
  const { examId } = await params
  const parsed = ExamUpsertSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }
  const { title, description, definition, passMark } = parsed.data

  // Once someone has taken this exam, the questions/answer key are frozen so that
  // recorded scores stay consistent. Title/description/pass mark/หมวด may still change.
  const [{ data: existing }, { count: gradedCount }] = await Promise.all([
    supabaseAdmin.from('competency_exams').select('definition').eq('id', examId).single(),
    supabaseAdmin.from('exam_assignments').select('id', { count: 'exact', head: true }).eq('exam_id', examId).eq('status', 'graded'),
  ])
  const existingQuestions = (existing?.definition as ExamDefinition | undefined)?.questions ?? []
  if ((gradedCount ?? 0) > 0 && JSON.stringify(existingQuestions) !== JSON.stringify(definition.questions)) {
    return NextResponse.json({ error: 'ข้อสอบนี้มีผู้ทำแล้ว ไม่สามารถแก้ไขคำถามหรือเฉลยได้ กรุณาสร้างข้อสอบใหม่' }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('competency_exams')
    .update({ title, description: description ?? null, definition, pass_mark: passMark, updated_at: new Date().toISOString() })
    .eq('id', examId)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { actor, response } = await requirePersonnelManage()
  if (!actor) return response
  const { examId } = await params
  const { error } = await supabaseAdmin.from('competency_exams').update({ active: false }).eq('id', examId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
