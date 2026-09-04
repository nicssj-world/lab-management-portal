import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/** Closed register rows are immutable across every register mutation route. */
export async function closedRegisterResponse(registerId: number): Promise<NextResponse | null> {
  const { data, error } = await supabaseAdmin
    .from('risk_register')
    .select('status')
    .eq('id', registerId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })
  if (data.status === 'closed') {
    return NextResponse.json({ error: 'รายการที่ปิดแล้วแก้ไขไม่ได้' }, { status: 409 })
  }
  return null
}
