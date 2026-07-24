import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireResource, requirePersonnelManage } from '@/lib/auth/guards'
import { ExamUpsertSchema } from '@/lib/personnel/exam'

// List exams (any personnel viewer). Includes assignment counts for the manage list.
export async function GET() {
  const { actor, response } = await requireResource('บุคลากร', 'view')
  if (!actor) return response
  const { data, error } = await supabaseAdmin
    .from('competency_exams')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// Create an exam. Admin/Manager (or section head via manage access) only.
export async function POST(req: NextRequest) {
  const { actor, response } = await requirePersonnelManage()
  if (!actor) return response
  const parsed = ExamUpsertSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }
  const { title, description, definition, passMark } = parsed.data
  const { data, error } = await supabaseAdmin
    .from('competency_exams')
    .insert({ title, description: description ?? null, definition, pass_mark: passMark, created_by: actor.id })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log')
    .insert({ action: 'personnel.exam.create', user_id: actor.id, target: data.id, detail: title })
    .then(undefined, () => {})

  return NextResponse.json(data, { status: 201 })
}
