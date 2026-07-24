import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { definitionForTaking, type ExamDefinition } from '@/lib/personnel/exam'
import { TakeClient } from './TakeClient'

export default async function TakeExamPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: assignment } = await supabaseAdmin.from('exam_assignments').select('*').eq('id', assignmentId).single()
  if (!assignment || assignment.profile_id !== user.id) redirect('/staff/personnel/exams')
  if (assignment.status !== 'open') redirect('/staff/personnel/exams')

  const { data: exam } = await supabaseAdmin.from('competency_exams').select('*').eq('id', assignment.exam_id).single()
  if (!exam) notFound()

  const forTaking = definitionForTaking(exam.definition as ExamDefinition)
  return <TakeClient assignmentId={assignmentId} title={exam.title} description={exam.description} questions={forTaking.questions} />
}
