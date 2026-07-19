import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireIt, auditIt } from '@/lib/it-access/guard'
import { getItSystems } from '@/lib/queries/it-access'
import { ItAccessRecordUpdateSchema } from '@/lib/validations/it-access'
import { buildUpdateDetail } from '@/lib/it-access/audit-detail'
import type { ItAccessRecord } from '@/lib/supabase/types'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireIt('edit')
  if ('error' in guard) return guard.error
  const actor = guard.actor
  const { id } = await params

  const parsed = ItAccessRecordUpdateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }
  const input = parsed.data

  const { data: before } = await supabaseAdmin
    .from('it_access_records')
    .select('*, profile:profiles!it_access_records_profile_id_fkey(name)')
    .eq('id', id).single()
  if (!before) return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 })

  if (input.system_ids && input.system_ids.length > 0) {
    const { data: sys } = await supabaseAdmin.from('it_systems').select('id').in('id', input.system_ids)
    if ((sys?.length ?? 0) !== input.system_ids.length) {
      return NextResponse.json({ error: 'มีระบบที่ไม่ถูกต้องในรายการ' }, { status: 422 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('it_access_records').update(input).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const systemsList = await getItSystems(supabaseAdmin)
  const names = new Map(systemsList.map((s) => [s.id, s.name]))
  const personName = (before as { profile?: { name?: string } }).profile?.name ?? ''
  const detail = buildUpdateDetail(personName, before as ItAccessRecord, data as ItAccessRecord, names)
  if (detail) auditIt('it_access.update', actor.id, id, detail)

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireIt('edit')
  if ('error' in guard) return guard.error
  const actor = guard.actor
  const { id } = await params

  const { data: deleted, error } = await supabaseAdmin
    .from('it_access_records')
    .delete().eq('id', id)
    .select('id, profile:profiles!it_access_records_profile_id_fkey(name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const personName = (deleted as { profile?: { name?: string } })?.profile?.name ?? ''
  auditIt('it_access.delete', actor.id, id, `ถอนสิทธิ์/ลบ ${personName}`)
  return NextResponse.json({ ok: true })
}
