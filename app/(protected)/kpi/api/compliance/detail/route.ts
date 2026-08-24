import { NextResponse, type NextRequest } from 'next/server'
import { getActor, canAccessResource, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { getAssignedDeptIds, getDepartments } from '@/lib/queries/kpi'
import { getKpiComplianceDetail } from '@/lib/queries/kpi-compliance'
import { isValidKpiFiscalYear, isValidKpiMonth } from '@/lib/kpi/period-validation'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()

  const searchParams = request.nextUrl.searchParams
  const year = parseInt(searchParams.get('year') ?? '0', 10)
  const month = parseInt(searchParams.get('month') ?? '0', 10)
  const requestedDept = searchParams.get('dept')?.trim() ?? ''
  if (!isValidKpiFiscalYear(year) || !isValidKpiMonth(month) || !requestedDept) {
    return NextResponse.json({ error: 'year, month and dept are required' }, { status: 400 })
  }

  try {
    const [canViewAll, departments] = await Promise.all([
      canAccessResource(actor, 'KPI', 'view'),
      getDepartments(supabaseAdmin),
    ])
    const assignedIds = canViewAll ? [] : await getAssignedDeptIds(supabaseAdmin, actor.id)
    if (!canViewAll && assignedIds.length === 0) return jsonForbidden()
    const assignedSet = new Set(assignedIds)
    const department = departments.find((item) =>
      (item.code === requestedDept || String(item.id) === requestedDept) &&
      (canViewAll || assignedSet.has(item.id)),
    )
    if (!department) return jsonForbidden()

    const detail = await getKpiComplianceDetail(supabaseAdmin, {
      fiscalYear: year,
      month,
      deptId: department.id,
    })
    return NextResponse.json(detail)
  } catch (error) {
    console.error('KPI compliance detail GET failed', error)
    return NextResponse.json({ error: 'ไม่สามารถโหลดรายละเอียดสถานะการส่ง KPI ได้' }, { status: 500 })
  }
}

