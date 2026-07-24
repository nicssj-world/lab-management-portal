import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getStaffRoster } from '@/lib/queries/personnel'
import { canManagePersonnel } from '@/lib/personnel/roles'
import { normalizeRole } from '@/lib/roles'
import { ExamsClient, type ExamRow, type MyAssignment, type RosterPerson } from './ExamsClient'
import type { CompetencyExam } from '@/lib/personnel/exam'

// Any authenticated staff can open this page to take exams assigned to them;
// the manage section is gated to Admin/Manager below.
export default async function ExamsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const canManage = canManagePersonnel(normalizeRole(actor?.role))

  const { data: assignRows } = await supabaseAdmin
    .from('exam_assignments')
    .select('id, status, score, passed, exam:competency_exams(id, title, description)')
    .eq('profile_id', user.id)
    .order('assigned_at', { ascending: false })
  const myAssignments: MyAssignment[] = (assignRows ?? []).map((a) => {
    const exam = Array.isArray(a.exam) ? a.exam[0] : a.exam
    return { id: a.id, status: a.status, score: a.score, passed: a.passed, title: exam?.title ?? 'ข้อสอบ', description: exam?.description ?? null }
  })

  let exams: ExamRow[] = []
  let roster: RosterPerson[] = []
  let categories: string[] = []
  if (canManage) {
    const [{ data: examData }, rosterData, { data: cats }] = await Promise.all([
      supabaseAdmin.from('competency_exams').select('*').eq('active', true).order('created_at', { ascending: false }),
      getStaffRoster(),
      supabaseAdmin.from('categories').select('th').order('th'),
    ])
    const counts = new Map<string, number>()
    const graded = new Map<string, number>()
    const { data: assignAll } = await supabaseAdmin.from('exam_assignments').select('exam_id, status')
    for (const a of assignAll ?? []) {
      counts.set(a.exam_id, (counts.get(a.exam_id) ?? 0) + 1)
      if (a.status === 'graded') graded.set(a.exam_id, (graded.get(a.exam_id) ?? 0) + 1)
    }
    exams = ((examData ?? []) as CompetencyExam[]).map((e) => ({ ...e, assignedCount: counts.get(e.id) ?? 0, gradedCount: graded.get(e.id) ?? 0 }))
    roster = rosterData.map((p) => ({ id: p.id, name: p.name, dept: p.dept }))
    categories = (cats ?? []).map((c) => c.th as string)
  }

  return <ExamsClient myAssignments={myAssignments} exams={exams} roster={roster} categories={categories} canManage={canManage} />
}
