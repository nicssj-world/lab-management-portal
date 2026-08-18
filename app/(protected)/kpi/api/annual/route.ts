import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActor, canAccessResource, jsonUnauthorized, jsonForbidden } from '@/lib/auth/guards'
import { getAnnualData, getAssignedDeptIds, getDepartments, getExclusions } from '@/lib/queries/kpi'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isValidKpiFiscalYear } from '@/lib/kpi/period-validation'

export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()

  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? '0', 10)
  const dept = searchParams.get('dept') ?? undefined

  if (!isValidKpiFiscalYear(year)) return NextResponse.json({ error: 'year is invalid' }, { status: 400 })

  let visibleDeptCodes: Set<string> | undefined
  if (!(await canAccessResource(actor, 'KPI', 'view'))) {
    const assignedIds = await getAssignedDeptIds(supabaseAdmin, actor.id)
    if (assignedIds.length === 0) return jsonForbidden()
    const assignedIdSet = new Set(assignedIds)
    const departments = await getDepartments(supabaseAdmin)
    const assignedCodes = departments.filter((department) => assignedIdSet.has(department.id)).map((department) => department.code)
    if (assignedCodes.length === 0) return jsonForbidden()
    if (dept && !assignedCodes.includes(dept)) return jsonForbidden()
    if (!dept) visibleDeptCodes = new Set(assignedCodes)
  }

  const exclusions = await getExclusions(supabaseAdmin)
  const data = await getAnnualData(supabase, year, dept || undefined, exclusions, visibleDeptCodes)
  return NextResponse.json(data)
}
