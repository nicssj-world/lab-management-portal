import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditHeadContact, requireHeadContactAccess } from '@/lib/head-contact/guard'
import { HeadContactUnitUpdateSchema } from '@/lib/validations/head-contact'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHeadContactAccess()
  if ('error' in guard) return guard.error
  const parsed = HeadContactUnitUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('head_contact_service_units')
    .update({ ...parsed.data, updated_at: new Date().toISOString(), updated_by: guard.actor.id })
    .eq('id', id)
    .select('id, name, display_order, is_active')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'มีหน่วยชื่อนี้อยู่แล้ว' : error.message }, { status: error.code === '23505' ? 409 : 500 })
  if (!data) return NextResponse.json({ error: 'ไม่พบหน่วยรับบริการ' }, { status: 404 })
  auditHeadContact('head_contact.unit_update', guard.actor.id, id, `แก้ไขหน่วย ${data.name}`)
  return NextResponse.json(data)
}
