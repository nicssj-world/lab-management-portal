import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateSamplingSchema } from '@/lib/it-verification/validation'
import { auditVerification, canManageVerification, jsonDatabaseError, requireItVerification } from '@/lib/it-verification/guard'
import { IT_DEPARTMENTS } from '@/lib/it-verification/domain'

export async function POST(request: NextRequest) {
  const guard = await requireItVerification('view')
  if ('error' in guard) return guard.error
  if (!canManageVerification(guard.actor)) return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ IT เท่านั้นที่ดึงตัวอย่างได้' }, { status: 403 })

  const parsed = generateSamplingSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลการสุ่มไม่ถูกต้อง' }, { status: 422 })
  if (parsed.data.departmentId != null && !IT_DEPARTMENTS.some((department) => department.id === parsed.data.departmentId)) {
    return NextResponse.json({ error: 'หน่วยงานนี้ไม่อยู่ในขอบเขตการทวนสอบ IT' }, { status: 422 })
  }

  // Keep all-department generation within one request while using one RPC per
  // department. Large TAT exports can exceed the database statement timeout
  // when the sampler scans every department in one transaction.
  const departments = parsed.data.departmentId == null
    ? IT_DEPARTMENTS
    : IT_DEPARTMENTS.filter((department) => department.id === parsed.data.departmentId)
  const items: unknown[] = []
  for (const department of departments) {
    const { data, error } = await supabaseAdmin.rpc('generate_it_verification_samples_from_tat', {
      p_upload_id: parsed.data.uploadId,
      p_actor_id: guard.actor.id,
      p_trigger: 'manual_generate',
      p_department_id: department.id,
    })
    if (error) return jsonDatabaseError(error)
    if (Array.isArray(data)) items.push(...data)
  }
  await auditVerification('sampling.generate', guard.actor.id, parsed.data.uploadId, `department=${parsed.data.departmentId ?? 'all'}`)
  return NextResponse.json({ items })
}
