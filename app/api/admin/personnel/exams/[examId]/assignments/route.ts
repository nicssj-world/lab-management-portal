import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requirePersonnelManage } from '@/lib/auth/guards'

type Params = { params: Promise<{ examId: string }> }

// Per-person results of one exam, for the section head. Admin/Manager only.
export async function GET(_req: NextRequest, { params }: Params) {
  const { actor, response } = await requirePersonnelManage()
  if (!actor) return response
  const { examId } = await params
  const { data, error } = await supabaseAdmin
    .from('exam_assignments')
    .select('id, status, score, passed, submitted_at, profile:profiles(id, name, dept)')
    .eq('exam_id', examId)
    .order('assigned_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data ?? []).map((a) => {
    const p = Array.isArray(a.profile) ? a.profile[0] : a.profile
    return { id: a.id, name: p?.name ?? '—', dept: p?.dept ?? null, status: a.status, score: a.score, passed: a.passed, submitted_at: a.submitted_at }
  })
  return NextResponse.json({ data: rows })
}
