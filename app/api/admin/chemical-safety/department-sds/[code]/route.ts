import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { parseJson, unexpectedError } from '@/lib/chemical-safety/api'
import { requireDepartmentSdsPublisher } from '@/lib/chemical-safety/department-access'
import { supabaseAdmin } from '@/lib/supabase/admin'

const patchSchema = z.object({
  displayName: z.string().trim().min(1).max(300),
}).strict()

// หมายเหตุ: โฟลเดอร์นี้ตั้งชื่อ [code] เพื่อให้ตรงกับ publish/route.ts ที่อยู่ระดับเดียวกัน
// (Next.js ไม่ยอมให้ dynamic segment ระดับเดียวกันใช้ชื่อพารามิเตอร์ต่างกัน)
// แต่ path param ของ route นี้จริง ๆ คือ id ของแถว chemical_department_sds ไม่ใช่รหัสงาน
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/admin/chemical-safety/department-sds/[code]'>,
) {
  const { code: id } = await ctx.params
  const input = await parseJson(request, patchSchema)
  if (input.response) return input.response

  try {
    const entry = await supabaseAdmin
      .from('chemical_department_sds')
      .select('id, department_code, display_name')
      .eq('id', id)
      .maybeSingle()
    if (entry.error) throw entry.error
    if (!entry.data) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })

    const guard = await requireDepartmentSdsPublisher(String(entry.data.department_code))
    if (guard.response) return guard.response

    // display_name_edited กันไม่ให้การ backfill รอบถัดไปเขียนทับชื่อที่คนแก้แล้ว
    const updated = await supabaseAdmin
      .from('chemical_department_sds')
      .update({
        display_name: input.data.displayName,
        display_name_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (updated.error) throw updated.error

    supabaseAdmin.from('audit_log').insert({
      action: 'chemical_safety.department_sds.rename',
      user_id: guard.actor.id,
      target: id,
      detail: JSON.stringify({ before: entry.data.display_name, after: input.data.displayName }),
    }).then(undefined, () => {})

    return NextResponse.json({ ok: true })
  } catch (error) {
    return unexpectedError(error)
  }
}
