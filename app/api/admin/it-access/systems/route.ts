import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireIt, auditIt } from '@/lib/it-access/guard'
import { ItSystemSchema } from '@/lib/validations/it-access'

export async function POST(req: NextRequest) {
  const guard = await requireIt('edit')
  if ('error' in guard) return guard.error
  const actor = guard.actor

  const parsed = ItSystemSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  // New systems slot after the current max order.
  const { data: maxRow } = await supabaseAdmin
    .from('it_systems').select('display_order')
    .order('display_order', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
  const displayOrder = (maxRow?.display_order ?? 0) + 1

  const { data, error } = await supabaseAdmin
    .from('it_systems')
    .insert({ name: parsed.data.name, display_order: displayOrder })
    .select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'มีระบบชื่อนี้อยู่แล้ว' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  auditIt('it_system.create', actor.id, data.id, data.name)
  return NextResponse.json(data, { status: 201 })
}
