import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireIt, auditIt } from '@/lib/it-access/guard'
import { ItAccessReviewSchema } from '@/lib/validations/it-access'

export async function GET() {
  const guard = await requireIt('view')
  if ('error' in guard) return guard.error

  const { data } = await supabaseAdmin
    .from('it_access_reviews').select('*').order('reviewed_at', { ascending: false })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const guard = await requireIt('edit')
  if ('error' in guard) return guard.error
  const actor = guard.actor

  const parsed = ItAccessReviewSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('it_access_reviews')
    .insert({ reviewed_by: actor.id, reviewed_by_name: actor.name ?? 'ไม่ทราบชื่อ', note: parsed.data.note })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  auditIt('it_access.review', actor.id, data.id, `ทบทวนสิทธิ์ประจำปี${parsed.data.note ? ' · ' + parsed.data.note : ''}`)
  return NextResponse.json(data, { status: 201 })
}
