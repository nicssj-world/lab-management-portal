import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { parseJson, unexpectedError } from '@/lib/chemical-safety/api'
import { requireDepartmentSdsPublisher } from '@/lib/chemical-safety/department-access'
import { departmentByCode } from '@/lib/chemical-safety/departments'
import { supabaseAdmin } from '@/lib/supabase/admin'

const publicationSchema = z.object({
  departmentCode: z.string().trim().min(1).max(80),
  status: z.enum(['draft', 'published']),
}).strict()

/**
 * จุดสั่งเผยแพร่ทั้งงานของ SDS — อยู่ในทะเบียนสารเคมีเพียงจุดเดียว
 * หน้า SDS แยกตามงานใช้แสดงผลอย่างเดียวและไม่เรียก route นี้โดยตรง
 */
export async function POST(request: NextRequest) {
  const input = await parseJson(request, publicationSchema)
  if (input.response) return input.response

  const department = departmentByCode(input.data.departmentCode)
  if (!department) return NextResponse.json({ error: 'ไม่พบงาน' }, { status: 404 })

  const guard = await requireDepartmentSdsPublisher(department.code)
  if (guard.response) return guard.response

  try {
    const updated = await supabaseAdmin.rpc('set_chemical_sds_department_publication_status', {
      p_department_code: department.code,
      p_status: input.data.status,
      p_actor_id: guard.actor.id,
    })
    if (updated.error) {
      if (/department_sds_empty/i.test(updated.error.message)) {
        return NextResponse.json({ error: 'งานนี้ยังไม่มีเอกสาร SDS ให้เผยแพร่' }, { status: 422 })
      }
      if (/department_sds_not_found/i.test(updated.error.message)) {
        return NextResponse.json({ error: 'ไม่พบงาน' }, { status: 404 })
      }
      throw updated.error
    }

    return NextResponse.json({ ok: true, departmentCode: department.code, status: input.data.status })
  } catch (error) {
    return unexpectedError(error)
  }
}
