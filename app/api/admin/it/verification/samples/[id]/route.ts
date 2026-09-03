import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditVerification, jsonDatabaseError, requireItVerification } from '@/lib/it-verification/guard'
import { sampleUpdateSchema } from '@/lib/it-verification/validation'
import { canEditVerificationRound, getVerificationRound } from '@/lib/it-verification/service'
import { getVerificationRoundDetail } from '@/lib/it-verification/queries'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireItVerification('view')
  if ('error' in guard) return guard.error
  const { id } = await params
  const parsed = sampleUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ผลการตรวจไม่ถูกต้อง' }, { status: 422 })

  const { data: sample, error: sampleError } = await supabaseAdmin
    .from('it_verification_samples').select('id, round_id, sample_state').eq('id', id).maybeSingle()
  if (sampleError) return jsonDatabaseError(sampleError)
  if (!sample || sample.sample_state !== 'active') return NextResponse.json({ error: 'ไม่พบตัวอย่างที่ยังใช้งานอยู่' }, { status: 404 })
  const round = await getVerificationRound(sample.round_id)
  if (!round) return NextResponse.json({ error: 'ไม่พบรอบการทวนสอบ' }, { status: 404 })
  if (!(await canEditVerificationRound(guard.actor, round))) {
    return NextResponse.json({ error: 'คุณไม่มีสิทธิ์แก้ไขตัวอย่างนี้ หรือรอบถูกล็อกแล้ว' }, { status: 403 })
  }

  const { error } = await supabaseAdmin.rpc('update_it_verification_sample', {
    p_sample_id: id,
    p_actor_id: guard.actor.id,
    p_lis_to_his: parsed.data.lisToHis,
    p_source_to_lis: parsed.data.sourceToLis,
    p_remark: parsed.data.remark,
    p_findings: parsed.data.findings,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: /requires|invalid|N\/A|finding/i.test(error.message) ? 422 : 500 })
  await auditVerification('sample.update', guard.actor.id, id, `round=${sample.round_id}`)
  const detail = await getVerificationRoundDetail(sample.round_id)
  return NextResponse.json({ detail })
}
