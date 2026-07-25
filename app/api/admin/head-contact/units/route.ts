import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { listHeadContactUnits } from '@/lib/head-contact/admin-server'
import { auditHeadContact, requireHeadContactAccess } from '@/lib/head-contact/guard'
import { HeadContactUnitCreateSchema } from '@/lib/validations/head-contact'

export async function GET() {
  const guard = await requireHeadContactAccess()
  if ('error' in guard) return guard.error
  return NextResponse.json(await listHeadContactUnits(), { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const guard = await requireHeadContactAccess()
  if ('error' in guard) return guard.error
  const parsed = HeadContactUnitCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  const { data: last } = await supabaseAdmin
    .from('head_contact_service_units')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data, error } = await supabaseAdmin
    .from('head_contact_service_units')
    .insert({ name: parsed.data.name, display_order: (last?.display_order ?? 0) + 10, updated_by: guard.actor.id })
    .select('id, name, display_order, is_active')
    .single()
  if (error) {
    return NextResponse.json({ error: error.code === '23505' ? 'มีหน่วยชื่อนี้อยู่แล้ว' : error.message }, { status: error.code === '23505' ? 409 : 500 })
  }
  auditHeadContact('head_contact.unit_create', guard.actor.id, data.id, `เพิ่มหน่วย ${data.name}`)
  return NextResponse.json(data, { status: 201 })
}
