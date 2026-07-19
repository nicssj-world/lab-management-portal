import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireIt, auditIt } from '@/lib/it-access/guard'
import { getItAccessRecords, getItSystems } from '@/lib/queries/it-access'
import { ItAccessRecordSchema } from '@/lib/validations/it-access'
import { buildCreateDetail } from '@/lib/it-access/audit-detail'
import type { ItAccessRecord } from '@/lib/supabase/types'

export async function GET() {
  const guard = await requireIt('view')
  if ('error' in guard) return guard.error

  const supabase = await createClient()
  const [items, systems] = await Promise.all([
    getItAccessRecords(supabaseAdmin),
    getItSystems(supabase),
  ])
  return NextResponse.json({ items, systems })
}

export async function POST(req: NextRequest) {
  const guard = await requireIt('edit')
  if ('error' in guard) return guard.error
  const actor = guard.actor

  const parsed = ItAccessRecordSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }
  const input = parsed.data

  // Person must exist in the personnel register.
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('id, name').eq('id', input.profile_id).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'ไม่พบบุคลากรในทะเบียน' }, { status: 422 })

  // All referenced systems must exist.
  if (input.system_ids.length > 0) {
    const { data: sys } = await supabaseAdmin.from('it_systems').select('id').in('id', input.system_ids)
    if ((sys?.length ?? 0) !== input.system_ids.length) {
      return NextResponse.json({ error: 'มีระบบที่ไม่ถูกต้องในรายการ' }, { status: 422 })
    }
  }

  // Auto display_order = current max + 1 when not provided.
  let displayOrder = input.display_order ?? null
  if (displayOrder == null) {
    const { data: maxRow } = await supabaseAdmin
      .from('it_access_records').select('display_order')
      .order('display_order', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
    displayOrder = (maxRow?.display_order ?? 0) + 1
  }

  const { data, error } = await supabaseAdmin
    .from('it_access_records')
    .insert({ ...input, display_order: displayOrder, created_by: actor.id })
    .select()
    .single()

  if (error) {
    if (error.code === '23505')
      return NextResponse.json({ error: 'บุคลากรคนนี้มีข้อมูลสิทธิ์อยู่แล้ว' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const systemsList = await getItSystems(supabaseAdmin)
  const names = new Map(systemsList.map((s) => [s.id, s.name]))
  auditIt('it_access.create', actor.id, data.id, buildCreateDetail(profile.name, data as ItAccessRecord, names))
  return NextResponse.json(data, { status: 201 })
}
