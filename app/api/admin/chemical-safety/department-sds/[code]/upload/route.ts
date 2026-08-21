import { NextResponse, type NextRequest } from 'next/server'
import { requireDepartmentSdsPublisher } from '@/lib/chemical-safety/department-access'
import { departmentByCode } from '@/lib/chemical-safety/departments'

/**
 * Existing department-file records remain maintainable, but creating a new
 * department-file entry is closed; new SDS records start from the registry.
 */
export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params
  const department = departmentByCode(code)
  if (!department) return NextResponse.json({ error: 'ไม่พบงาน' }, { status: 404 })

  const guard = await requireDepartmentSdsPublisher(department.code)
  if (guard.response) return guard.response

  return NextResponse.json({
    error: 'department_sds_creation_closed',
    message: 'กรุณาเพิ่มสารเคมีและจัดการ SDS จากทะเบียนสารเคมี',
  }, { status: 409 })
}
