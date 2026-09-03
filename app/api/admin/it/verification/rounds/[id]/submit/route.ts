import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditVerification, jsonDatabaseError, requireItVerification } from '@/lib/it-verification/guard'
import { canEditVerificationRound, getVerificationRound } from '@/lib/it-verification/service'
import { getRoundReadiness } from '@/lib/it-verification/workflow'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireItVerification('view')
  if ('error' in guard) return guard.error
  const { id } = await params
  const round = await getVerificationRound(id)
  if (!round) return NextResponse.json({ error: 'ไม่พบรอบการทวนสอบ' }, { status: 404 })
  if (round.status === 'reviewed') return NextResponse.json({ error: 'รอบนี้ถูกล็อกแล้ว' }, { status: 409 })
  if (!(await canEditVerificationRound(guard.actor, round))) return NextResponse.json({ error: 'คุณไม่มีสิทธิ์ส่งรอบนี้ตรวจ' }, { status: 403 })

  const readiness = await getRoundReadiness(id)
  if (!readiness.ready) {
    return NextResponse.json({ error: 'ยังส่งตรวจไม่ได้ กรุณาตรวจ sample ให้ครบและปิด finding ที่ค้างอยู่', readiness }, { status: 422 })
  }
  const { data, error } = await supabaseAdmin.from('it_verification_rounds').update({
    status: 'submitted', submitted_at: new Date().toISOString(), submitted_by: guard.actor.id, updated_at: new Date().toISOString(),
  }).eq('id', id).select().single()
  if (error) return jsonDatabaseError(error)
  await auditVerification('round.submit', guard.actor.id, id, `samples=${readiness.samples}`)
  return NextResponse.json(data)
}
