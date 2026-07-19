import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireIt, auditIt } from '@/lib/it-access/guard'

// Second step of the annual review: stamp the approval (ผู้อนุมัติ) onto an existing
// review row that has been reviewed but not yet approved.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireIt('edit')
  if ('error' in guard) return guard.error
  const actor = guard.actor
  const { id } = await params

  const { data: review } = await supabaseAdmin
    .from('it_access_reviews').select('id, approved_at').eq('id', id).single()
  if (!review) return NextResponse.json({ error: 'ไม่พบรายการทบทวน' }, { status: 404 })
  if (review.approved_at) return NextResponse.json({ error: 'รายการนี้อนุมัติแล้ว' }, { status: 409 })

  const { data, error } = await supabaseAdmin
    .from('it_access_reviews')
    .update({ approved_at: new Date().toISOString(), approved_by: actor.id, approved_by_name: actor.name ?? 'ไม่ทราบชื่อ' })
    .eq('id', id)
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  auditIt('it_access.review_approve', actor.id, id, 'อนุมัติการทบทวนสิทธิ์ประจำปี')
  return NextResponse.json(data)
}
