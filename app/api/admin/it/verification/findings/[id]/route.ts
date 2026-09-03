import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditVerification, jsonDatabaseError, requireItVerification } from '@/lib/it-verification/guard'
import { findingUpdateSchema } from '@/lib/it-verification/validation'
import { canEditVerificationRound, getVerificationRound } from '@/lib/it-verification/service'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireItVerification('view')
  if ('error' in guard) return guard.error
  const { id } = await params
  const parsed = findingUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูล finding ไม่ถูกต้อง' }, { status: 422 })

  const { data: finding, error: findingError } = await supabaseAdmin
    .from('it_verification_findings').select('id, round_id, sample_id, status').eq('id', id).maybeSingle()
  if (findingError) return jsonDatabaseError(findingError)
  if (!finding) return NextResponse.json({ error: 'ไม่พบ finding' }, { status: 404 })
  const { data: sample, error: sampleError } = await supabaseAdmin
    .from('it_verification_samples').select('sample_state').eq('id', finding.sample_id).maybeSingle()
  if (sampleError) return jsonDatabaseError(sampleError)
  if (!sample || sample.sample_state !== 'active') return NextResponse.json({ error: 'finding ของ sample ที่ถูก void แล้วแก้ไขไม่ได้' }, { status: 409 })
  const round = await getVerificationRound(finding.round_id)
  if (!round) return NextResponse.json({ error: 'ไม่พบรอบการทวนสอบ' }, { status: 404 })
  if (!(await canEditVerificationRound(guard.actor, round))) {
    return NextResponse.json({ error: 'คุณไม่มีสิทธิ์แก้ไข finding นี้ หรือรอบถูกล็อกแล้ว' }, { status: 403 })
  }

  const patch = {
    status: parsed.data.status,
    resolution_note: parsed.data.resolutionNote || null,
    closed_by: parsed.data.status === 'closed' ? guard.actor.id : null,
    closed_at: parsed.data.status === 'closed' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabaseAdmin.from('it_verification_findings').update(patch).eq('id', id).select().single()
  if (error) return jsonDatabaseError(error)
  await auditVerification('finding.update', guard.actor.id, id, `round=${finding.round_id}; status=${parsed.data.status}`)
  return NextResponse.json(data)
}
