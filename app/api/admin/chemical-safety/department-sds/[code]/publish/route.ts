import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { parseJson, unexpectedError } from '@/lib/chemical-safety/api'
import { requireDepartmentSdsPublisher } from '@/lib/chemical-safety/department-access'
import { departmentByCode } from '@/lib/chemical-safety/departments'
import { supabaseAdmin } from '@/lib/supabase/admin'

const publishSchema = z.object({
  status: z.enum(['draft', 'published']),
}).strict()

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/admin/chemical-safety/department-sds/[code]/publish'>,
) {
  const { code } = await ctx.params
  const input = await parseJson(request, publishSchema)
  if (input.response) return input.response

  const department = departmentByCode(code)
  if (!department) return NextResponse.json({ error: 'ไม่พบงาน' }, { status: 404 })

  const guard = await requireDepartmentSdsPublisher(department.code)
  if (guard.response) return guard.response

  try {
    if (input.data.status === 'published') {
      // เผยแพร่งานที่ไม่มีไฟล์เลยจะได้หัวข้อว่างบนหน้าสาธารณะ ซึ่งไม่มีประโยชน์กับใคร
      const count = await supabaseAdmin
        .from('chemical_department_sds')
        .select('id', { count: 'exact', head: true })
        .eq('department_code', department.code)
      if (count.error) throw count.error
      if ((count.count ?? 0) === 0) {
        return NextResponse.json({ error: 'งานนี้ยังไม่มีเอกสาร SDS ให้เผยแพร่' }, { status: 422 })
      }
    }

    const published = input.data.status === 'published'
    const updated = await supabaseAdmin
      .from('chemical_sds_departments')
      .update({
        status: input.data.status,
        published_by: published ? guard.actor.id : null,
        published_at: published ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('code', department.code)
    if (updated.error) throw updated.error

    supabaseAdmin.from('audit_log').insert({
      action: 'chemical_safety.department_sds.publish',
      user_id: guard.actor.id,
      target: department.code,
      detail: JSON.stringify({ department: department.department, status: input.data.status }),
    }).then(undefined, () => {})

    return NextResponse.json({ ok: true })
  } catch (error) {
    return unexpectedError(error)
  }
}
