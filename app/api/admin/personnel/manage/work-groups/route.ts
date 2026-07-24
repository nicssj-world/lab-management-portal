import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requirePersonnelManage } from '@/lib/auth/guards'
import { DEPARTMENTS } from '@/lib/validations/user-schema'

const Schema = z.object({
  name: z.string().trim().max(200).nullable().optional(),
  depts: z.array(z.enum(DEPARTMENTS)).min(2, 'ต้องเลือกอย่างน้อยสองงานเพื่อรวม'),
})

export async function GET() {
  const { actor, response } = await requirePersonnelManage()
  if (!actor) return response
  const { data, error } = await supabaseAdmin.from('personnel_work_groups').select('*').order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { actor, response } = await requirePersonnelManage()
  if (!actor) return response
  const parsed = Schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }
  const depts = [...new Set(parsed.data.depts)]
  const { data, error } = await supabaseAdmin
    .from('personnel_work_groups')
    .insert({ name: parsed.data.name?.trim() || null, depts, created_by: actor.id })
    .select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log')
    .insert({ action: 'personnel.work_group.create', user_id: actor.id, target: data.id, detail: depts.join(', ') })
    .then(undefined, () => {})

  return NextResponse.json(data, { status: 201 })
}
