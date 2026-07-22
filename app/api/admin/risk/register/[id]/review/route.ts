import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditRisk, canReviewRisk, getRiskActor } from '@/lib/risk/access'
import { nextReviewDate, todayBangkok } from '@/lib/risk/register'

/**
 * ยืนยันการทบทวนความเสี่ยงประจำปี (ISO 15189 8.5)
 *
 * บันทึกว่าใครทบทวนเมื่อไหร่ แล้วเลื่อนกำหนดครั้งถัดไปไปอีก 1 ปี
 * ไม่แตะคะแนน L×S หรือมาตรการ — ถ้าต้องเปลี่ยนค่าเหล่านั้นให้แก้ที่รายการโดยตรง
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReviewRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const today = todayBangkok()

  const { data, error } = await supabaseAdmin
    .from('risk_register')
    .update({
      last_reviewed_at: new Date().toISOString(),
      last_reviewed_by: actor.id,
      last_reviewed_by_name: actor.name,
      next_review_date: nextReviewDate(today),
      updated_at: new Date().toISOString(),
    })
    .eq('id', Number(id))
    .is('deleted_at', null)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })

  auditRisk('register.review', actor.id, data.risk_no ?? id, `ทบทวนแล้ว ครั้งถัดไป ${data.next_review_date}`)
  return NextResponse.json({ data })
}
