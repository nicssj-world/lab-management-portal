import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditVerification, canReviewVerification, jsonDatabaseError, requireItVerification } from '@/lib/it-verification/guard'
import { getVerificationRound } from '@/lib/it-verification/service'
import { reviewSchema } from '@/lib/it-verification/validation'
import { getRoundReadiness } from '@/lib/it-verification/workflow'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireItVerification('view')
  if ('error' in guard) return guard.error
  if (!canReviewVerification(guard.actor)) return NextResponse.json({ error: 'เฉพาะผู้มีอำนาจ review เท่านั้น' }, { status: 403 })
  const { id } = await params
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลการ review ไม่ถูกต้อง' }, { status: 422 })
  const round = await getVerificationRound(id)
  if (!round) return NextResponse.json({ error: 'ไม่พบรอบการทวนสอบ' }, { status: 404 })
  if (round.status !== 'submitted') return NextResponse.json({ error: 'รอบนี้ยังไม่อยู่ในสถานะรอผู้ตรวจสอบ' }, { status: 409 })

  const readiness = await getRoundReadiness(id)
  if (parsed.data.decision === 'approve' && !readiness.ready) {
    return NextResponse.json({ error: 'ข้อมูลยังไม่ครบถ้วน จึงล็อกผลการ review ไม่ได้', readiness }, { status: 422 })
  }

  const approved = parsed.data.decision === 'approve'
  const { data, error } = await supabaseAdmin.from('it_verification_rounds').update({
    status: approved ? 'reviewed' : 'draft',
    reviewed_at: approved ? new Date().toISOString() : null,
    reviewed_by: approved ? guard.actor.id : null,
    review_note: parsed.data.note || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id).select().single()
  if (error) return jsonDatabaseError(error)
  await auditVerification('round.review', guard.actor.id, id, `decision=${parsed.data.decision}`)
  return NextResponse.json(data)
}
