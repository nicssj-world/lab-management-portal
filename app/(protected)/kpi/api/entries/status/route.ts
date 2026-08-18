import { NextResponse, type NextRequest } from 'next/server'
import { getActor, canAccessResource, jsonUnauthorized, jsonForbidden } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { filterEntryStatusByDeptIds, getEntryStatus, getAssignedDeptIds } from '@/lib/queries/kpi'
import { isValidKpiFiscalYear } from '@/lib/kpi/period-validation'

export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()

  const canViewAll = await canAccessResource(actor, 'KPI', 'view')
  let visibleDeptIds: Set<number> | null = null
  if (!canViewAll) {
    const assigned = await getAssignedDeptIds(supabaseAdmin, actor.id)
    if (assigned.length === 0) return jsonForbidden()
    visibleDeptIds = new Set(assigned)
  }

  const year = parseInt(new URL(request.url).searchParams.get('year') ?? '0', 10)
  if (!isValidKpiFiscalYear(year)) return NextResponse.json({ error: 'year is invalid' }, { status: 400 })

  // admin client: the exclusions/assignees config tables have no RLS read policy
  const data = await getEntryStatus(supabaseAdmin, year)
  const visibleData = visibleDeptIds ? filterEntryStatusByDeptIds(data, visibleDeptIds) : data
  return NextResponse.json(visibleData)
}
