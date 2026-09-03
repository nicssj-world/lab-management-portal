import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditVerification, canReviewVerification, jsonDatabaseError, requireItVerification } from '@/lib/it-verification/guard'
import { getVerificationRound } from '@/lib/it-verification/service'
import { reasonSchema } from '@/lib/it-verification/validation'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireItVerification('view')
  if ('error' in guard) return guard.error
  if (!canReviewVerification(guard.actor)) return NextResponse.json({ error: 'เฉพาะผู้มีอำนาจ reopen เท่านั้น' }, { status: 403 })
  const { id } = await params
  const parsed = reasonSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'กรุณาระบุเหตุผล' }, { status: 422 })
  const round = await getVerificationRound(id)
  if (!round) return NextResponse.json({ error: 'ไม่พบรอบการทวนสอบ' }, { status: 404 })
  if (round.status !== 'reviewed') return NextResponse.json({ error: 'รอบนี้ยังไม่ได้ล็อก' }, { status: 409 })

  const { data, error } = await supabaseAdmin.from('it_verification_rounds').update({
    status: 'draft', review_note: `Reopen: ${parsed.data.reason}`, updated_at: new Date().toISOString(),
  }).eq('id', id).select().single()
  if (error) return jsonDatabaseError(error)
  await auditVerification('round.reopen', guard.actor.id, id, parsed.data.reason)
  return NextResponse.json(data)
}
