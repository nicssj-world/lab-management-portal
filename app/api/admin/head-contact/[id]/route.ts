import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canDeleteHeadContact } from '@/lib/head-contact/access'
import { auditHeadContact, requireHeadContactAccess } from '@/lib/head-contact/guard'
import { HeadContactUpdateSchema } from '@/lib/validations/head-contact'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Context) {
  const guard = await requireHeadContactAccess()
  if ('error' in guard) return guard.error
  const parsed = HeadContactUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  const { id } = await params
  const { data: before } = await supabaseAdmin
    .from('head_contact_submissions')
    .select('status, action_note, contacted_at, contact_note')
    .eq('id', id)
    .maybeSingle()
  if (!before) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })

  const patch: Record<string, unknown> = {
    ...parsed.data,
    action_note: parsed.data.action_note?.trim() || (parsed.data.action_note === null ? null : undefined),
    contact_note: parsed.data.contact_note?.trim() || (parsed.data.contact_note === null ? null : undefined),
    updated_at: new Date().toISOString(),
    updated_by: guard.actor.id,
  }
  if (parsed.data.status === 'closed' && before.status !== 'closed') {
    patch.closed_at = new Date().toISOString()
    patch.closed_by = guard.actor.id
  } else if (parsed.data.status && parsed.data.status !== 'closed' && before.status === 'closed') {
    patch.closed_at = null
    patch.closed_by = null
  }
  Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key])
  const { data, error } = await supabaseAdmin
    .from('head_contact_submissions')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (parsed.data.status && parsed.data.status !== before.status) {
    auditHeadContact('head_contact.status_update', guard.actor.id, id, `${before.status} → ${parsed.data.status}`)
  }
  if ('action_note' in parsed.data) auditHeadContact('head_contact.action_note_update', guard.actor.id, id, 'แก้ไขผลการดำเนินการ')
  if ('contacted_at' in parsed.data || 'contact_note' in parsed.data) {
    auditHeadContact('head_contact.contact_logged', guard.actor.id, id, parsed.data.contacted_at ? 'บันทึกการติดต่อกลับ' : 'แก้ไขข้อมูลการติดต่อกลับ')
  }
  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const guard = await requireHeadContactAccess()
  if ('error' in guard) return guard.error
  if (!canDeleteHeadContact(guard.actor)) return NextResponse.json({ error: 'ลบรายการได้เฉพาะผู้ดูแลระบบ' }, { status: 403 })
  const { id } = await params
  const { error } = await supabaseAdmin.from('head_contact_submissions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  auditHeadContact('head_contact.delete', guard.actor.id, id, 'ลบเรื่องสื่อสารถึงหัวหน้า')
  return NextResponse.json({ ok: true })
}
