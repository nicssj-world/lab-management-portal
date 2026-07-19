import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireIt, auditIt } from '@/lib/it-access/guard'
import { ItSystemUpdateSchema } from '@/lib/validations/it-access'

// Rename or toggle is_active. No DELETE — systems are deactivated, never removed,
// so existing register rows that reference them keep resolving their name.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireIt('edit')
  if ('error' in guard) return guard.error
  const actor = guard.actor
  const { id } = await params

  const parsed = ItSystemUpdateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('it_systems').update(parsed.data).eq('id', id).select().single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'มีระบบชื่อนี้อยู่แล้ว' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  auditIt('it_system.update', actor.id, id, `${data.name}${data.is_active ? '' : ' · ปิดใช้งาน'}`)
  return NextResponse.json(data)
}
