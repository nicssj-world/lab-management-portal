import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActor, jsonUnauthorized, jsonForbidden } from '@/lib/auth/guards'
import { ExamSubmitSchema, gradeExam, type ExamDefinition } from '@/lib/personnel/exam'

type Params = { params: Promise<{ assignmentId: string }> }

function bangkokToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

// The assigned staff member submits their answers; auto-graded and recorded as a competency.
export async function POST(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  const { assignmentId } = await params

  const { data: assignment, error: aErr } = await supabaseAdmin
    .from('exam_assignments').select('*').eq('id', assignmentId).single()
  if (aErr || !assignment) return NextResponse.json({ error: 'ไม่พบแบบทดสอบที่มอบหมาย' }, { status: 404 })
  if (assignment.profile_id !== actor.id) return jsonForbidden()
  if (assignment.status !== 'open') return NextResponse.json({ error: 'แบบทดสอบนี้ส่งไปแล้ว' }, { status: 422 })

  const parsed = ExamSubmitSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })

  const { data: exam, error: eErr } = await supabaseAdmin
    .from('competency_exams').select('*').eq('id', assignment.exam_id).single()
  if (eErr || !exam) return NextResponse.json({ error: 'ไม่พบข้อสอบ' }, { status: 404 })

  const definition = exam.definition as ExamDefinition
  const result = gradeExam(definition, parsed.data.answers, Number(exam.pass_mark))
  const answerKey: Record<string, string> = {}
  for (const q of definition.questions ?? []) {
    const correct = q.options.find((o) => o.isCorrect)
    if (correct) answerKey[q.id] = correct.id
  }
  const today = bangkokToday()

  // Record the outcome as a competency assessment.
  const { data: comp } = await supabaseAdmin
    .from('staff_competencies')
    .insert({
      profile_id: actor.id,
      assessment_type: 'periodic',
      area: exam.title,
      assessor_id: assignment.assigned_by,
      assessment_date: today,
      score_knowledge: result.score,
      result: result.passed ? 'pass' : 'fail',
      notes: `ข้อสอบสมรรถนะ: ตอบถูก ${result.correct}/${result.total} ข้อ (${result.score}%)`,
      created_by: actor.id,
    })
    .select('id')
    .single()

  const { error: uErr } = await supabaseAdmin
    .from('exam_assignments')
    .update({
      status: 'graded', score: result.score, passed: result.passed, answers: parsed.data.answers,
      submitted_at: new Date().toISOString(), competency_id: comp?.id ?? null,
    })
    .eq('id', assignmentId)
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, score: result.score, passed: result.passed, correct: result.correct, total: result.total, answerKey })
}
