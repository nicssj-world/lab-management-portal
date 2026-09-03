import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resampleSchema } from '@/lib/it-verification/validation'
import { auditVerification, canManageVerification, jsonDatabaseError, requireItVerification } from '@/lib/it-verification/guard'
import { getQuarterFromMonth, IT_DEPARTMENTS } from '@/lib/it-verification/domain'

export async function POST(request: NextRequest) {
  const guard = await requireItVerification('view')
  if ('error' in guard) return guard.error
  if (!canManageVerification(guard.actor)) return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ IT เท่านั้นที่สุ่มใหม่ได้' }, { status: 403 })

  const parsed = resampleSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลการสุ่มใหม่ไม่ถูกต้อง' }, { status: 422 })
  if (!IT_DEPARTMENTS.some((department) => department.id === parsed.data.departmentId)) {
    return NextResponse.json({ error: 'หน่วยงานนี้ไม่อยู่ในขอบเขตการทวนสอบ IT' }, { status: 422 })
  }

  const { data: upload, error: uploadError } = await supabaseAdmin
    .from('tat_uploads').select('id, year, month').eq('id', parsed.data.uploadId).maybeSingle()
  if (uploadError) return jsonDatabaseError(uploadError)
  if (!upload) return NextResponse.json({ error: 'ไม่พบไฟล์ TAT ต้นทาง อัปโหลดเดือนนี้ใหม่ก่อนสุ่ม' }, { status: 404 })

  const quarter = getQuarterFromMonth(upload.month)
  const { data: round, error: roundError } = await supabaseAdmin
    .from('it_verification_rounds')
    .select('id, status')
    .eq('year', upload.year)
    .eq('quarter', quarter)
    .eq('department_id', parsed.data.departmentId)
    .maybeSingle()
  if (roundError) return jsonDatabaseError(roundError)
  if (!round) return NextResponse.json({ error: 'ยังไม่มีรอบการทวนสอบของหน่วยงานนี้' }, { status: 404 })
  if (round.status === 'reviewed') return NextResponse.json({ error: 'รอบนี้ถูกล็อกแล้ว ต้อง reopen ก่อนสุ่มใหม่' }, { status: 409 })

  const { data, error } = await supabaseAdmin.rpc('resample_it_verification_samples_from_tat', {
    p_upload_id: parsed.data.uploadId,
    p_actor_id: guard.actor.id,
    p_department_id: parsed.data.departmentId,
    p_reason: parsed.data.reason,
  })
  if (error) return jsonDatabaseError(error)
  await auditVerification('sampling.resample', guard.actor.id, round.id, `department=${parsed.data.departmentId}; reason=${parsed.data.reason}`)
  return NextResponse.json({ items: data ?? [] })
}
