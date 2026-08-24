import { NextResponse, type NextRequest } from 'next/server'
import { getActor, canAccessResource, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { getAssignedDeptIds, getDepartments } from '@/lib/queries/kpi'
import { getKpiCompliance } from '@/lib/queries/kpi-compliance'
import { SUBMISSION_STATUSES, type SubmissionStatus } from '@/lib/kpi/compliance'
import { isValidKpiFiscalYear } from '@/lib/kpi/period-validation'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()

  const searchParams = request.nextUrl.searchParams
  const year = parseInt(searchParams.get('year') ?? '0', 10)
  const requestedDept = searchParams.get('dept')?.trim() ?? ''
  const requestedStatus = searchParams.get('status')?.trim() ?? ''
  if (!isValidKpiFiscalYear(year)) return NextResponse.json({ error: 'year is invalid' }, { status: 400 })
  if (requestedStatus && !SUBMISSION_STATUSES.includes(requestedStatus as SubmissionStatus)) {
    return NextResponse.json({ error: 'status is invalid' }, { status: 400 })
  }

  try {
    const [canViewAll, departments] = await Promise.all([
      canAccessResource(actor, 'KPI', 'view'),
      getDepartments(supabaseAdmin),
    ])
    const assignedIds = canViewAll ? [] : await getAssignedDeptIds(supabaseAdmin, actor.id)
    if (!canViewAll && assignedIds.length === 0) return jsonForbidden()
    const assignedSet = new Set(assignedIds)
    const allowedDepartments = canViewAll
      ? departments
      : departments.filter((department) => assignedSet.has(department.id))
    if (allowedDepartments.length === 0) return jsonForbidden()

    const selectedDepartment = requestedDept
      ? allowedDepartments.find((department) => department.code === requestedDept || String(department.id) === requestedDept)
      : undefined
    if (requestedDept && !selectedDepartment) return jsonForbidden()

    const response = await getKpiCompliance(supabaseAdmin, year, {
      departments: selectedDepartment ? [selectedDepartment] : allowedDepartments,
      status: requestedStatus ? requestedStatus as SubmissionStatus : undefined,
    })
    return NextResponse.json(response)
  } catch (error) {
    console.error('KPI compliance GET failed', error)
    return NextResponse.json({ error: 'ไม่สามารถโหลดสถานะการส่ง KPI ได้' }, { status: 500 })
  }
}
